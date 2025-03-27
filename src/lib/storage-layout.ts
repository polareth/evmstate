import { Address, Hex } from "tevm";
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
import { createStorageLayoutAdapter, StorageLayoutAdapter } from "@/lib/adapter";
import { findLayoutInfoAtSlot } from "@/lib/slots/engine";
import { GetContractsOptions, GetContractsResult, LabeledStorageAccess, MappingKey, StorageDiff } from "@/lib/types";
import { decodeHex } from "@/lib/utils";

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
export const getStorageLayoutAdapter = async ({
  address,
  metadata,
  sources,
}: GetContractsResult[Address] & { address: Address }) => {
  const { compilerVersion, evmVersion } = metadata;

  // Return empty layout if we're missing critical information
  if (!compilerVersion || !evmVersion || !sources || sources.length === 0) {
    debug(`Missing compiler info for ${address}. Cannot generate storage layout.`);
    return {};
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

    const layouts = Object.values(output.contracts)
      .flatMap((layouts) => Object.values(layouts))
      .map((l) => l.storageLayout) as unknown as Array<SolcStorageLayout>;

    // Aggregate all storage items and types from different layouts
    const aggregatedTypes: SolcStorageLayoutTypes = layouts.reduce((acc, layout) => {
      if (!layout?.types) return acc;
      return { ...acc, ...layout.types };
    }, {} as SolcStorageLayoutTypes);

    // Now that we have all types, we can properly type the storage items
    const aggregatedStorage: Array<SolcStorageLayoutItem<typeof aggregatedTypes>> = layouts.reduce(
      (acc, layout) => {
        if (!layout?.storage) return acc;
        return [...acc, ...layout.storage];
      },
      [] as Array<SolcStorageLayoutItem<typeof aggregatedTypes>>,
    );

    // Return a storage layout adapter for advanced access patterns
    return createStorageLayoutAdapter(
      {
        storage: aggregatedStorage,
        types: aggregatedTypes,
      },
      undefined,
    ); // no need to inject a client here as we don't want to access storage
  } catch (error) {
    debug(`Error generating storage layout for ${address}:`, error);
    return {};
  }
};

type FormatLabeledStorageAccessOptions = {
  access: StorageDiff[Hex];
  slot: Hex;
  adapter: StorageLayoutAdapter;
  potentialKeys: Array<MappingKey>;
};

export const formatLabeledStorageAccess = ({
  access,
  slot,
  adapter,
  potentialKeys,
}: FormatLabeledStorageAccessOptions): Array<LabeledStorageAccess> => {
  const { current: currentHex, next: nextHex } = access;

  // Find all labels for this slot using our slot engine
  const slotInfo = findLayoutInfoAtSlot(slot, adapter, potentialKeys);

  if (slotInfo.length > 0) {
    // Found matches - return an array of labeled reads for this slot
    return slotInfo.map((info) => {
      let result = {
        label: info.label,
        type: info.type,
        kind:
          info.matchType === "mapping" || info.matchType === "nested-mapping"
            ? "mapping"
            : info.matchType === "array"
              ? "array"
              : info.type?.startsWith("struct")
                ? "struct"
                : info.type === "string" || info.type === "bytes"
                  ? "bytes"
                  : !!info.type
                    ? "primitive"
                    : undefined,

        slots: [slot],
      };

      // Decode the value based on its type and offset (if applicable)
      const current = decodeHex(currentHex, info.type, info.offset);
      const next = nextHex ? decodeHex(nextHex, info.type, info.offset) : undefined;
      const modified = !!next?.decoded && current.decoded !== next.decoded;
      const trace = {
        current: current.decoded,
        modified,
      };
      if (modified) trace.next = next.decoded;

      if (result.kind === "mapping") {
        result.trace = [
          {
            ...trace,
            keys:
              info.keys && info.keys.length > 0
                ? info.keys.map((key) => ({
                    value: key.decoded ?? decodeHex(key.hex, key.type).decoded,
                    type: key.type,
                  }))
                : [],
          },
        ];
      } else if (result.kind === "array") {
        result.trace = [{ ...trace, index: info.index ? decodeHex(info.index, "uint256").decoded : 0 }];
      } else {
        result.trace = trace;
        if (info.offset) result.offset = info.offset;
      }
      return result;
    }) as Array<LabeledStorageAccess>;
  } else {
    // No match found, use a fallback label
    return [
      {
        label: `slot_${slot.slice(0, 10)}`,
        trace: { current: currentHex, next: access.next },
        slots: [slot],
      } as LabeledStorageAccess,
    ];
  }
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
