import { Address } from "tevm";
import {
  createSolc,
  releases,
  SolcSettings,
  SolcStorageLayout,
  SolcStorageLayoutItem,
  SolcStorageLayoutTypes,
} from "tevm/bundler/solc";
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
      acc[r.address as Address] = {
        metadata: {
          name: r.contractResult?.name ?? undefined,
          evmVersion: r.contractResult?.evmVersion,
          compilerVersion: r.contractResult?.compilerVersion,
        },
        sources: sources[index]?.filter(({ path }) => !ignoredSourcePaths.some((p) => path?.includes(p))),
        abi: r.abi,
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
}: GetContractsResult[Address] & { address: Address }) => {
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
        evmVersion: metadata.evmVersion as SolcSettings["evmVersion"],
        outputSelection: {
          "*": {
            "*": ["storageLayout"],
          },
        },
      },
      sources: Object.fromEntries(sources.map(({ path, content }) => [path ?? randomBytes(8).toString(), { content }])),
    });

    // Find the most relevant storage layout for this contract
    const contractLayout = findMostRelevantLayout(output, name);

    if (!contractLayout) {
      debug(`Could not find a relevant storage layout for ${address} (${name || "unnamed"})`);
      return undefined;
    }

    return {
      storage: contractLayout.storage || [],
      types: contractLayout.types || {},
    };
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
        console.log(output.contracts[sourcePath][contractName].storageLayout);
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
    const release = Object.entries(releases).find(([_, v]) => v === `v${_version}`);
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
