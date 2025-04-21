import { Address } from "tevm";
import { createSolc, releases, SolcSettings, SolcStorageLayout } from "tevm/bundler/solc";
import { randomBytes } from "tevm/utils";
import { autoload, loaders } from "@shazow/whatsabi";

import { debug } from "@/debug";
import { GetContractsOptions, GetContractsResult } from "@/lib/trace/types";

const ignoredSourcePaths = ["metadata.json", "creator-tx-hash.txt", "immutable-references"];

/** Fetches contract information for a list of addresses using external services */
export const getContracts = async ({
  client,
  addresses,
  explorers,
}: GetContractsOptions): Promise<GetContractsResult> => {
  const abiLoader = new loaders.MultiABILoader([
    new loaders.SourcifyABILoader({ chainId: client.chain?.id }),
    new loaders.EtherscanABILoader({
      baseURL: explorers?.etherscan?.baseUrl ?? "https://api.etherscan.io/api",
      apiKey: explorers?.etherscan?.apiKey,
    }),
    new loaders.BlockscoutABILoader({
      baseURL: explorers?.blockscout?.baseUrl ?? "https://eth.blockscout.com/api",
      apiKey: explorers?.blockscout?.apiKey,
    }),
  ]);

  try {
    // Get the contract sources and ABI
    const responses = await Promise.all(
      addresses.map((address) =>
        autoload(address, {
          provider: client,
          abiLoader,
          followProxies: true,
          loadContractResult: true,
        }),
      ),
    );

    const sources = await Promise.all(responses.map((r) => r.contractResult?.getSources?.()));

    return responses.reduce((acc, r, index) => {
      acc[addresses[index]] = {
        metadata: {
          name: r.contractResult?.name ?? undefined,
          evmVersion: r.contractResult?.evmVersion,
          compilerVersion: r.contractResult?.compilerVersion,
        },
        sources: sources[index]?.filter(({ path }) => !ignoredSourcePaths.some((p) => path?.includes(p))),
        abi: r.abi,
        isProxy: r.address !== addresses[index],
      };
      return acc;
    }, {} as GetContractsResult);
  } catch (err) {
    console.error(err);
    return {};
  }
};

/**
 * Gets the storage layout for a contract from its sources and metadata
 *
 * @returns A comprehensive storage layout adapter with methods for accessing storage data & utils
 */
export const getStorageLayout = async ({
  address,
  metadata,
  sources,
  isProxy,
}: GetContractsResult[Address] & { address: Address }): Promise<SolcStorageLayout | undefined> => {
  const { compilerVersion, evmVersion, name } = metadata;

  // Return empty layout if we're missing critical information
  if (!compilerVersion || !evmVersion || !sources || sources.length === 0) {
    debug(`Missing compiler info for ${address}. Cannot generate storage layout.`);
    return undefined;
  }

  try {
    const solc = await createSolc(getSolcVersion(compilerVersion));
    const output = solc.compile({
      language: "Solidity",
      settings: {
        evmVersion: metadata.evmVersion === "Default" ? undefined : (metadata.evmVersion as SolcSettings["evmVersion"]),
        outputSelection: {
          "*": {
            "*": ["storageLayout"],
          },
        },
      },
      sources: Object.fromEntries(sources.map(({ path, content }) => [path ?? randomBytes(8).toString(), { content }])),
    });

    if (output.errors && Object.keys(output.contracts).length === 0) {
      debug(`Errors when generating storage layout for ${address} with version ${compilerVersion}:`, output.errors);
      return undefined;
    }

    // Find the most relevant storage layout for this contract
    let contractLayout = findMostRelevantLayout(output, name);

    if (!contractLayout) {
      debug(`Could not find a relevant storage layout for ${address} (${name || "unnamed"})`);
      return undefined;
    }

    const { storage, types } = !isProxy
      ? contractLayout
      : {
          storage: contractLayout.storage.concat([
            {
              astId: -1,
              contract: name ?? address,
              label: "__implementation",
              offset: 0,
              // EIP-1967 implementation slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
              slot: BigInt("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc").toString(),
              type: "t_address",
            },
            {
              astId: -1,
              contract: name ?? address,
              label: "__admin",
              offset: 0,
              // EIP-1967 admin slot: bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1)
              slot: BigInt("0xb53127684a568b3173ae13b9f8a6016e019b2c8e8cbb2a6e0a23387fdaa12345").toString(),
              type: "t_address",
            },
          ]),
          types: {
            ...contractLayout.types,
            t_address: {
              encoding: "inplace" as const,
              label: "address",
              numberOfBytes: "20",
            },
          },
        };

    return { storage, types };
  } catch (error) {
    debug(`Error generating storage layout for ${address}:`, error);
    return undefined;
  }
};

/**
 * Finds the most relevant storage layout for a contract.
 *
 * Prioritizes exact name matches, then falls back to the most complete layout
 *
 * TODO: something specific for proxies (we need the implementation layout + add some special custom variables for
 * implementation address, etc?)
 */
export const findMostRelevantLayout = (output: any, contractName?: string): SolcStorageLayout | undefined => {
  if (!output?.contracts) return undefined;

  // If we have a contract name, try to find an exact match first
  if (contractName) {
    for (const sourcePath in output.contracts) {
      if (output.contracts[sourcePath][contractName]) {
        return output.contracts[sourcePath][contractName].storageLayout;
      }
    }

    // If no exact match, try case-insensitive match
    const lowerName = contractName.toLowerCase();
    for (const sourcePath in output.contracts) {
      for (const cName in output.contracts[sourcePath]) {
        if (cName.toLowerCase() === lowerName) {
          return output.contracts[sourcePath][cName].storageLayout;
        }
      }
    }
  }

  // If we still don't have a match, find the contract with the most storage variables
  // This is a heuristic that assumes the implementation contract has more storage than proxies/libraries
  let bestLayout: SolcStorageLayout | undefined;
  let maxStorageItems = -1;

  for (const sourcePath in output.contracts) {
    for (const cName in output.contracts[sourcePath]) {
      const layout = output.contracts[sourcePath][cName].storageLayout;
      if (layout?.storage && layout.storage.length > maxStorageItems) {
        maxStorageItems = layout.storage.length;
        bestLayout = layout;
      }
    }
  }

  return bestLayout;
};

/** Converts a compiler version string to a recognized solc version */
const getSolcVersion = (_version: string) => {
  try {
    // Try exact version match first
    const release = Object.entries(releases).find(([_, v]) => v.includes(_version));
    if (release) return release[0] as keyof typeof releases;

    // Try approximate match (e.g. 0.8.17 might match with 0.8.19)
    const majorMinor = _version.split(".").slice(0, 2).join(".");
    const fallbackRelease = Object.entries(releases)
      .filter(([_, v]) => v.startsWith(`v${majorMinor}`))
      .sort((a, b) => b[1].localeCompare(a[1]))[0]; // Sort to get latest

    if (fallbackRelease) {
      debug(`Exact Solc version ${_version} not found, using ${fallbackRelease[1]}`);
      return fallbackRelease[0] as keyof typeof releases;
    }

    // Default to a recent 0.8.x version
    debug(`No compatible Solc version for ${_version}, using fallback`);
    return "0.8.17" as keyof typeof releases;
  } catch (error) {
    debug(`Error finding Solc version for ${_version}:`, error);
    return "0.8.17" as keyof typeof releases;
  }
};
