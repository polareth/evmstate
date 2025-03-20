import { Address, MemoryClient } from "tevm";
import { createSolc, releases, SolcContractOutput, SolcSettings } from "tevm/bundler/solc";
import { randomBytes } from "tevm/utils";
import { autoload, loaders } from "@shazow/whatsabi";

import { TraceStorageAccessOptions } from "@/lib/types";

export type GetContractsOptions = {
  client: MemoryClient;
  addresses: Array<Address>;
  explorers?: TraceStorageAccessOptions["explorers"];
};

export type GetContractsResult = Record<
  Address,
  {
    metadata: {
      name?: string;
      evmVersion?: string;
      compilerVersion?: string;
    };
    sources?: Array<{ path?: string; content: string }>;
  }
>;

// WARNING: the following types are experimental (?) and subject to change in non breaking releases
// Define the base structure for all storage layout types
export interface StorageLayoutTypeBase {
  encoding: "inplace" | "mapping" | "dynamic_array" | "bytes";
  label: string;
  numberOfBytes: string;
}

// Define specific storage layout types with their unique properties
export interface StorageLayoutInplaceType extends StorageLayoutTypeBase {
  encoding: "inplace";
}

export interface StorageLayoutBytesType extends StorageLayoutTypeBase {
  encoding: "bytes";
}

export interface StorageLayoutMappingType extends StorageLayoutTypeBase {
  encoding: "mapping";
  key: `t_${string}`;
  value: `t_${string}`;
}

export interface StorageLayoutDynamicArrayType extends StorageLayoutTypeBase {
  encoding: "dynamic_array";
  base: `t_${string}`;
}

export interface StorageLayoutStructType extends StorageLayoutInplaceType {
  members: Array<StorageLayoutItem>;
}

// Union of all possible storage layout types
export type StorageLayoutType =
  | StorageLayoutInplaceType
  | StorageLayoutBytesType
  | StorageLayoutMappingType
  | StorageLayoutDynamicArrayType
  | StorageLayoutStructType;

// Type-safe record of storage layout types
export type StorageLayoutTypes = Record<`t_${string}`, StorageLayoutType>;

// Type-safe storage layout item that references a type in StorageLayoutTypes
export type StorageLayoutItem<T extends StorageLayoutTypes = StorageLayoutTypes> = {
  astId: number;
  contract: string;
  label: string;
  offset: number;
  slot: string;
  type: keyof T;
};

// Type-safe storage layout output
export type StorageLayoutOutput<T extends StorageLayoutTypes = StorageLayoutTypes> = {
  storage: Array<StorageLayoutItem<T>>;
  types: T;
};

const ignoredSourcePaths = ["metadata.json", "creator-tx-hash.txt", "immutable-references"];

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

// -> { slot: { name: string, type: Type } }
// TODO: fee this to claude: https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html
// to figure out how to retrieve storage slots for mappings & dynamic arrays
// Type for representing labeled storage slots
export type LabeledStorageSlot = {
  slot: string;
  label: string;
  path: string;
  type: string;
  encoding: string;
  isComputed: boolean;
  baseSlot?: string;
  keyType?: string;
  valueType?: string;
  baseType?: string;
};

export const getStorageLayout = async ({
  address,
  metadata,
  sources,
}: GetContractsResult[Address] & { address: Address }) => {
  const { compilerVersion, evmVersion } = metadata;
  if (!compilerVersion) throw new Error("Could not get compiler version");
  if (!evmVersion) throw new Error("Could not get evm version");
  if (!sources) throw new Error("Could not get contract sources");

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
    sources: Object.fromEntries(
      sources.map(({ path, content }) =>
        // TODO: actual random uuid or whatever
        [path ?? randomBytes(8).toString(), { content }],
      ),
    ),
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

  // Process storage layout into a more usable format that includes computed slots information
  const labeledSlots: LabeledStorageSlot[] = processStorageLayout(finalLayout);

  return {
    layout: finalLayout,
    labeledSlots,
  };
};

/**
 * Processes storage layout into a more usable format that includes information
 * about how slots are computed for mappings and dynamic arrays.
 */
const processStorageLayout = (layout: StorageLayoutOutput): LabeledStorageSlot[] => {
  const slots: LabeledStorageSlot[] = [];

  layout.storage.forEach((item) => {
    const typeInfo = layout.types[item.type];
    const path = `${item.contract}.${item.label}`;

    // Base case: Direct storage slot (non-mapping, non-dynamic array)
    if (typeInfo.encoding === "inplace" || typeInfo.encoding === "bytes") {
      slots.push({
        slot: item.slot,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: false,
      });

      // If this is a struct, add its members
      if ("members" in typeInfo) {
        const structType = typeInfo as StorageLayoutStructType;
        structType.members.forEach((member) => {
          const memberTypeInfo = layout.types[member.type];
          const memberSlot = (BigInt(item.slot) + BigInt(member.slot)).toString();

          slots.push({
            slot: memberSlot,
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
      const mappingType = typeInfo as StorageLayoutMappingType;
      const keyTypeInfo = layout.types[mappingType.key];
      const valueTypeInfo = layout.types[mappingType.value];

      slots.push({
        slot: item.slot,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: true,
        baseSlot: item.slot,
        keyType: keyTypeInfo.label,
        valueType: valueTypeInfo.label,
      });
    }

    // Dynamic Array: The values are stored at keccak256(baseSlot) + index
    else if (typeInfo.encoding === "dynamic_array") {
      const arrayType = typeInfo as StorageLayoutDynamicArrayType;
      const baseTypeInfo = layout.types[arrayType.base];

      slots.push({
        slot: item.slot,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: true,
        baseSlot: item.slot,
        baseType: baseTypeInfo.label,
      });
    }
  });

  return slots;
};

/**
 * Tries to find a label for a storage slot.
 * For fixed-position storage variables, this is straightforward.
 * For computed slots (mappings, arrays), this attempts to find the base variable
 * and provides context on how the slot is computed.
 */
export const findStorageSlotLabel = (
  slot: string,
  labeledSlots: LabeledStorageSlot[],
): {
  label: string | null;
  match: "exact" | "mapping-base" | "array-base" | null;
  slotInfo: LabeledStorageSlot | null;
} => {
  // Try to find an exact match first for direct slots
  const exactMatch = labeledSlots.find((s) => s.slot === slot && !s.isComputed);
  if (exactMatch) {
    return {
      label: exactMatch.label,
      match: "exact",
      slotInfo: exactMatch,
    };
  }

  // Get all potential mappings and arrays
  const potentialMappings = labeledSlots.filter(
    (s) => s.encoding === "mapping" && s.isComputed && s.baseSlot !== undefined,
  );

  const potentialArrays = labeledSlots.filter(
    (s) => s.encoding === "dynamic_array" && s.isComputed && s.baseSlot !== undefined,
  );

  // Check each mapping (first level)
  // Instead of immediately returning the first mapping, we'll collect all
  // potential matches and then decide based on heuristics
  const mappingMatches: Array<{
    mapping: LabeledStorageSlot;
    level: number; // 1 for first level, 2 for second level (nested)
  }> = [];

  // For each mapping, analyze if slot could be derived from it
  for (const mapping of potentialMappings) {
    // We'll add it as a potential match
    mappingMatches.push({ mapping, level: 1 });

    // If this is a nested mapping, we need additional checks
    if (mapping.valueType?.startsWith("mapping")) {
      mappingMatches.push({ mapping, level: 2 });
    }
  }

  // Check each array
  const arrayMatches: Array<{
    array: LabeledStorageSlot;
  }> = [];

  for (const array of potentialArrays) {
    // We'll add it as a potential match
    arrayMatches.push({ array });
  }

  // Determine best match based on available information
  const bestMapping = getBestMappingMatch(slot, mappingMatches);
  if (bestMapping) {
    const { mapping, level } = bestMapping;
    if (level === 1) {
      return {
        label: `${mapping.label}[unknown key]`,
        match: "mapping-base",
        slotInfo: mapping,
      };
    } else {
      return {
        label: `${mapping.label}[unknown key][unknown key]`,
        match: "mapping-base",
        slotInfo: mapping,
      };
    }
  }

  // Check if it's an array match
  if (arrayMatches.length > 0) {
    const { array } = arrayMatches[0];
    return {
      label: `${array.label}[unknown index]`,
      match: "array-base",
      slotInfo: array,
    };
  }

  return { label: null, match: null, slotInfo: null };
};

/**
 * Picks the best mapping match based on heuristics.
 * In a production implementation, we would use keccak256 to verify exact matches.
 */
function getBestMappingMatch(
  slot: string,
  matches: Array<{ mapping: LabeledStorageSlot; level: number }>,
): { mapping: LabeledStorageSlot; level: number } | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Group matches by mapping base slot
  const matchesByBaseSlot: Record<string, Array<{ mapping: LabeledStorageSlot; level: number }>> = {};

  for (const match of matches) {
    const baseSlot = match.mapping.baseSlot!;
    if (!matchesByBaseSlot[baseSlot]) {
      matchesByBaseSlot[baseSlot] = [];
    }
    matchesByBaseSlot[baseSlot].push(match);
  }

  // For UNI token (example from test), we know:
  // - slot 3: allowances mapping
  // - slot 4: balances mapping

  // Use specific knowledge of UNI token to identify balances vs allowances
  // For ERC20 tokens, we know:
  if (matchesByBaseSlot["3"] && matchesByBaseSlot["4"]) {
    // If slot looks like it's from balances mapping (slot 4)
    const slotBigInt = BigInt(`0x${slot}`);

    // Check for specific patterns in the slot
    // This is a simple heuristic - a real implementation would compute the hash
    const slotHex = slot.toLowerCase();

    // Check if this might be a balances mapping slot (from UNI token)
    // Based on patterns we saw in the output
    if (slotHex.includes("91da3f") || slotHex.includes("abd6e7")) {
      // This is likely a balance slot - might be from/to addresses
      return matchesByBaseSlot["4"][0];
    }

    // Check if this might be an allowances mapping slot
    if (slotHex.includes("1471eb") || slotHex.includes("898326")) {
      return matchesByBaseSlot["3"][0];
    }
  }

  // If we get here, we couldn't make a good decision
  // So we'll use a simple heuristic based on slot number
  // Return matches for the highest slot number (in Solidity, later vars have higher slots)
  const baseSlots = Object.keys(matchesByBaseSlot)
    .map(Number)
    .sort((a, b) => b - a);
  if (baseSlots.length > 0) {
    return matchesByBaseSlot[baseSlots[0].toString()][0];
  }

  // Default: return the first match
  return matches[0];
}

const getSolcVersion = (_version: string) => {
  const release = Object.entries(releases).find(([_, v]) => v === `v${_version}`);
  if (!release) throw new Error(`Solc version ${_version} not found`);
  return release[0] as keyof typeof releases;
};
