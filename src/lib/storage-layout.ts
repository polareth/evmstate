import { Address, MemoryClient } from "tevm";
import { createSolc, releases, SolcSettings } from "tevm/bundler/solc";
import { randomBytes } from "tevm/utils";
import { autoload, loaders } from "@shazow/whatsabi";

import {
  GetContractsOptions,
  GetContractsResult,
  StorageLayoutItem,
  StorageLayoutOutput,
  StorageLayoutType,
  StorageLayoutTypes,
  StorageSlotInfo,
} from "@/lib/types";

const ignoredSourcePaths = ["metadata.json", "creator-tx-hash.txt", "immutable-references"];

/**
 * Fetches contract information for a list of addresses using external services
 */
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
 */
export const getStorageLayout = async ({
  address,
  metadata,
  sources,
}: GetContractsResult[Address] & { address: Address }) => {
  const { compilerVersion, evmVersion } = metadata;

  // Return empty layout if we're missing critical information
  if (!compilerVersion || !evmVersion || !sources || sources.length === 0) {
    console.warn(`Missing compiler info for ${address}. Cannot generate storage layout.`);
    return {
      layout: { storage: [], types: {} },
      labeledSlots: [],
    };
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
      .map((l) => l.storageLayout) as Array<StorageLayoutOutput>;

    // Aggregate all storage items and types from different layouts
    const aggregatedTypes: StorageLayoutTypes = layouts.reduce((acc, layout) => {
      if (!layout?.types) return acc;
      return { ...acc, ...layout.types };
    }, {} as StorageLayoutTypes);

    // Now that we have all types, we can properly type the storage items
    const aggregatedStorage: Array<StorageLayoutItem<typeof aggregatedTypes>> = layouts.reduce(
      (acc, layout) => {
        if (!layout?.storage) return acc;
        return [...acc, ...layout.storage];
      },
      [] as Array<StorageLayoutItem<typeof aggregatedTypes>>,
    );

    // Create the final storage layout with properly typed relationships
    const finalLayout: StorageLayoutOutput<typeof aggregatedTypes> = {
      storage: aggregatedStorage,
      types: aggregatedTypes,
    };

    // Process storage layout into a more usable format
    const labeledSlots: StorageSlotInfo[] = processStorageLayout(finalLayout);

    return {
      layout: finalLayout,
      labeledSlots,
    };
  } catch (error) {
    console.error(`Error generating storage layout for ${address}:`, error);
    return {
      layout: { storage: [], types: {} },
      labeledSlots: [],
    };
  }
};

/**
 * Processes storage layout from the Solidity compiler into a more usable format.
 * Handles static variables, mappings, arrays, and structs.
 */
// TODO: review
const processStorageLayout = (layout: StorageLayoutOutput): StorageSlotInfo[] => {
  const slots: StorageSlotInfo[] = [];

  // Helper to normalize slot numbers to consistent format
  const normalizeSlot = (slot: string): string => {
    if (!slot) return "0";
    return slot.toString().toLowerCase().replace(/^0x/, "");
  };

  layout.storage.forEach((item) => {
    const typeInfo = layout.types[item.type];
    const path = `${item.contract}.${item.label}`;
    const normalizedSlot = normalizeSlot(item.slot);

    // Base case: Direct storage slot (non-mapping, non-dynamic array)
    if (typeInfo.encoding === "inplace" || typeInfo.encoding === "bytes") {
      slots.push({
        slot: `0x${normalizedSlot}`,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: false,
      });

      // If this is a struct, add its members
      if ("members" in typeInfo) {
        const structType = typeInfo as StorageLayoutType & { members: StorageLayoutItem[] };
        structType.members.forEach((member) => {
          const memberTypeInfo = layout.types[member.type];
          const memberSlotBigInt = BigInt("0x" + normalizedSlot) + BigInt(member.slot);
          const memberSlot = memberSlotBigInt.toString(16);

          slots.push({
            slot: `0x${memberSlot}`,
            label: `${item.label}.${member.label}`,
            path: `${path}.${member.label}`,
            type: memberTypeInfo.label,
            encoding: memberTypeInfo.encoding,
            isComputed: false,
          });
        });
      }
    }
    // Mapping: The values are stored at keccak256(key, baseSlot)
    else if (typeInfo.encoding === "mapping") {
      const mappingType = typeInfo as StorageLayoutType & {
        key: `t_${string}`;
        value: `t_${string}`;
      };

      const keyTypeInfo = layout.types[mappingType.key];
      const valueTypeInfo = layout.types[mappingType.value];

      slots.push({
        slot: `0x${normalizedSlot}`,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: true,
        baseSlot: normalizedSlot,
        keyType: keyTypeInfo.label,
        valueType: valueTypeInfo.label,
      });
    }
    // Dynamic Array: The values are stored at keccak256(baseSlot) + index
    else if (typeInfo.encoding === "dynamic_array") {
      const arrayType = typeInfo as StorageLayoutType & { base: `t_${string}` };
      const baseTypeInfo = layout.types[arrayType.base];

      slots.push({
        slot: `0x${normalizedSlot}`,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: true,
        baseSlot: normalizedSlot,
        baseType: baseTypeInfo.label,
      });
    }
  });

  return slots;
};

/**
 * Converts a compiler version string to a recognized solc version
 */
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
      console.warn(`Exact Solc version ${_version} not found, using ${fallbackRelease[1]}`);
      return fallbackRelease[0] as keyof typeof releases;
    }

    // Default to a recent 0.8.x version
    console.warn(`No compatible Solc version for ${_version}, using fallback`);
    return "0.8.17" as keyof typeof releases;
  } catch (error) {
    console.error(`Error finding Solc version for ${_version}:`, error);
    return "0.8.17" as keyof typeof releases;
  }
};
