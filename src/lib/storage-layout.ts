import { Address, Hex, hexToBigInt, isHex, toHex } from "tevm";
import { createSolc, releases, SolcSettings } from "tevm/bundler/solc";
import { randomBytes } from "tevm/utils";
import { autoload, loaders } from "@shazow/whatsabi";

import { findLayoutInfoAtSlot } from "@/lib/slot-engine";
import {
  GetContractsOptions,
  GetContractsResult,
  LabeledStorageRead,
  LabeledStorageWrite,
  MappingKey,
  StorageLayoutItem,
  StorageLayoutOutput,
  StorageLayoutTypes,
  StorageReads,
  StorageSlotInfo,
  StorageWrites,
} from "@/lib/types";
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

/** Gets the storage layout for a contract from its sources and metadata */
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
 * Processes storage layout from the Solidity compiler into a more usable format. Handles static variables, mappings,
 * arrays, and structs.
 */
const processStorageLayout = (layout: StorageLayoutOutput): StorageSlotInfo[] => {
  const slots: StorageSlotInfo[] = [];

  layout.storage.forEach((item) => {
    const typeInfo = layout.types[item.type];
    const path = `${item.contract}.${item.label}`;
    const slotHex = toHex(Number(item.slot), { size: 32 });

    // Base case: Direct storage slot (non-mapping, non-dynamic array)
    if (typeInfo.encoding === "inplace" || typeInfo.encoding === "bytes") {
      slots.push({
        slot: slotHex,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: false,
        offset: item.offset,
      } as const satisfies StorageSlotInfo<"inplace" | "bytes">);

      // If this is a struct, add its members
      if ("members" in typeInfo) {
        typeInfo.members.forEach((member) => {
          const memberTypeInfo = layout.types[member.type];
          const memberSlotHex = toHex(hexToBigInt(slotHex) + BigInt(member.slot), { size: 32 });

          slots.push({
            slot: memberSlotHex,
            label: `${item.label}.${member.label}`,
            path: `${path}.${member.label}`,
            type: memberTypeInfo.label,
            encoding: memberTypeInfo.encoding as "inplace" | "bytes",
            isComputed: false,
            offset: member.offset,
          } as const satisfies StorageSlotInfo<"inplace" | "bytes">);
        });
      }
    }
    // Mapping: The values are stored at keccak256(key, baseSlot)
    else if (typeInfo.encoding === "mapping") {
      const keyTypeInfo = layout.types[typeInfo.key];
      const valueTypeInfo = layout.types[typeInfo.value];

      slots.push({
        slot: slotHex,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: true,
        keyType: keyTypeInfo.label,
        valueType: valueTypeInfo.label,
      } as const satisfies StorageSlotInfo<"mapping">);
    }
    // Dynamic Array: The values are stored at keccak256(baseSlot) + index
    else if (typeInfo.encoding === "dynamic_array") {
      const baseTypeInfo = layout.types[typeInfo.base];

      slots.push({
        slot: slotHex,
        label: item.label,
        path,
        type: typeInfo.label,
        encoding: typeInfo.encoding,
        isComputed: true,
        baseType: baseTypeInfo.label,
      } as const satisfies StorageSlotInfo<"dynamic_array">);
    }
  });

  return slots;
};

type FormatLabeledStorageOpOptions<T extends StorageReads[Hex] | StorageWrites[Hex]> = {
  op: T;
  slot: Hex;
  contractLayout: Array<StorageSlotInfo>;
  potentialKeys: Array<MappingKey>;
};

type FormatLabeledStorageOpResult<T extends StorageReads[Hex] | StorageWrites[Hex]> = T extends StorageWrites[Hex]
  ? [LabeledStorageWrite, ...LabeledStorageWrite[]]
  : T extends StorageReads[Hex]
    ? [LabeledStorageRead, ...LabeledStorageRead[]]
    : never;

export const formatLabeledStorageOp = <T extends StorageReads[Hex] | StorageWrites[Hex]>({
  op,
  slot,
  contractLayout,
  potentialKeys,
}: FormatLabeledStorageOpOptions<T>): FormatLabeledStorageOpResult<T> => {
  const { current: currentHex } = op;

  // Find all labels for this slot using our slot engine
  const slotInfo = findLayoutInfoAtSlot(slot, contractLayout, potentialKeys);

  if (slotInfo.length > 0) {
    // Found matches - return an array of labeled reads for this slot
    return slotInfo.map((info) => {
      // Decode the value based on its type and offset (if applicable)
      const current = decodeHex(currentHex, info.type, info.offset);

      const result: LabeledStorageRead | LabeledStorageWrite = {
        label: info.label,
        type: info.type,
        current,
      };

      if ("next" in op) (result as LabeledStorageWrite).next = decodeHex(op.next, info.type, info.offset);

      if (info.offset) result.offset = info.offset;
      if (info.index !== undefined) result.index = decodeHex(info.index, "uint256").decoded;
      if (info.keys && info.keys.length > 0)
        result.keys = info.keys.map((key) => (key.decoded ? key : { ...decodeHex(key.hex, key.type), type: key.type }));

      return result;
    }) as FormatLabeledStorageOpResult<T>;
  } else {
    // No match found, use a fallback label
    return ("next" in op
      ? [
          {
            label: `var_${slot.slice(0, 10)}`,
            current: { hex: currentHex },
            next: { hex: op.next },
          },
        ]
      : [
          {
            label: `var_${slot.slice(0, 10)}`,
            current: { hex: currentHex },
          },
        ]) as unknown as FormatLabeledStorageOpResult<T>;
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
