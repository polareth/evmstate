import {
  SolcStorageLayoutBytesType,
  SolcStorageLayoutInplaceType,
  SolcStorageLayoutItem,
  SolcStorageLayoutStructType,
  SolcStorageLayoutTypeBase,
  SolcStorageLayoutTypes,
} from "tevm/bundler/solc";
import { decodeAbiParameters, Hex, hexToBigInt, hexToString, keccak256, padHex, toHex } from "viem";

import { debug } from "@/debug";
import { LabeledStorageAccess, StorageDiff } from "@/lib/types";

export const decode = <T extends SolcStorageLayoutTypes>(
  storageTrace: StorageDiff,
  storageItems: Array<SolcStorageLayoutItem<T>>,
  types: T,
) => {
  const byType = getItemsByType(storageItems, types);
  let unexploredSlots: Set<Hex> = new Set([...Object.keys(storageTrace)] as Array<Hex>);

  // 1. Decode any primitive that has its slot in the trace
  const primitives = handlePrimitives(storageTrace, byType.primitives, types, unexploredSlots);
  // 2. Same for structs (keep the original unexplored slots because it could be packed in the same slot as a primitive)
  const structs = handleStructs(storageTrace, byType.structs, types, unexploredSlots);
  // 3. Same for bytes (string or bytes)
  const bytes = handleBytes(storageTrace, byType.bytes, types, unexploredSlots);

  // Remove occupied slots from unexplored slots
  Object.values(primitives).forEach((primitive) => primitive.slots.forEach((slot) => unexploredSlots.delete(slot)));
  Object.values(structs).forEach((struct) => struct.slots.forEach((slot) => unexploredSlots.delete(slot)));
  Object.values(bytes).forEach((byte) => byte.slots.forEach((slot) => unexploredSlots.delete(slot)));

  return {
    decoded: { ...primitives, ...structs, ...bytes } as Record<string, LabeledStorageAccess>,
    unexploredSlots,
  };
};

const getItemsByType = <T extends SolcStorageLayoutTypes>(storageItems: Array<SolcStorageLayoutItem<T>>, types: T) => ({
  primitives: storageItems.filter((item) =>
    Object.entries(types).find(
      ([typeId, type]) => item.type === typeId && type.encoding === "inplace" && !type.label.startsWith("struct"),
    ),
  ),
  structs: storageItems.filter((item) =>
    Object.entries(types).find(([typeId, type]) => item.type === typeId && type.label.startsWith("struct")),
  ),
  bytes: storageItems.filter((item) =>
    Object.entries(types).find(([typeId, type]) => item.type === typeId && type.encoding === "bytes"),
  ),
  mappings: storageItems.filter((item) =>
    Object.entries(types).find(([typeId, type]) => item.type === typeId && type.encoding === "mapping"),
  ),
  arrays: {
    static: storageItems.filter((item) =>
      Object.entries(types).find(([typeId, type]) => item.type === typeId && type.label.match(/\[\d+\]$/)),
    ),
    dynamic: storageItems.filter((item) =>
      Object.entries(types).find(([typeId, type]) => item.type === typeId && type.encoding === "dynamic_array"),
    ),
  },
});

/* -------------------------------- PRIMITIVE ------------------------------- */
const handlePrimitives = <T extends SolcStorageLayoutTypes>(
  storageTrace: StorageDiff,
  primitives: Array<SolcStorageLayoutItem<T>>,
  types: T,
  unexploredSlots: Set<Hex>,
) => {
  const touchedPrimitives = primitives.filter((item) => unexploredSlots.has(toHex(BigInt(item.slot), { size: 32 })));
  return Object.fromEntries(
    touchedPrimitives.map((item) => [
      item.label,
      omitZeroOffset({
        trace: decodePrimitive(storageTrace, item, types),
        slots: [toHex(BigInt(item.slot), { size: 32 })],
        label: item.label,
        type: (types[item.type] as SolcStorageLayoutInplaceType).label,
        offset: item.offset,
        kind: "primitive" as const,
      }) as LabeledStorageAccess<typeof item.label, string, T>,
    ]),
  );
};

const decodePrimitive = <T extends SolcStorageLayoutTypes>(
  storageTrace: StorageDiff,
  item: SolcStorageLayoutItem<T>,
  types: T,
) => {
  const slotHex = toHex(BigInt(item.slot), { size: 32 });
  const typeInfo = types[item.type] as SolcStorageLayoutInplaceType;
  const storage = storageTrace[slotHex];

  const decode = (hex: Hex) => {
    try {
      const extractedHex = extractRelevantHex(hex, item.offset, Number(typeInfo.numberOfBytes));
      return decodeAbiParameters([{ type: typeInfo.label }], extractedHex)[0];
    } catch (error) {
      debug(`Error decoding ${item.type.toString()} of type ${typeInfo.label}:`, error);
      return undefined;
    }
  };

  const current = decode(storage.current);
  const next = storage.next && storage.next !== storage.current ? decode(storage.next) : undefined;
  const modified = next ? next !== current : false;
  return {
    current,
    next: modified ? next : undefined,
    modified,
  };
};

/* --------------------------------- STRUCTS -------------------------------- */
const handleStructs = <T extends SolcStorageLayoutTypes>(
  storageTrace: StorageDiff,
  structs: Array<SolcStorageLayoutItem<T>>,
  types: T,
  unexploredSlots: Set<Hex>,
) => {
  // First retrieve all slots occupied by structs depending on their size
  const structsWithOccupiedSlots = structs.map((item) => {
    const typeInfo = types[item.type] as SolcStorageLayoutStructType;

    // Extract current and next storage for each slot
    const currentStorage = Object.fromEntries(Object.entries(storageTrace).map(([slot, data]) => [slot, data.current]));
    const nextStorage = Object.fromEntries(Object.entries(storageTrace).map(([slot, data]) => [slot, data.next]));

    // Extract struct members from the current storage
    const extractedMembers = extractStructMembers(currentStorage, item.slot, item.offset, typeInfo.members, types);

    const occupiedSlots = extractedMembers.map((member) => member.slot);
    const commonSlots = [...unexploredSlots].filter((slot) => occupiedSlots.includes(slot));

    // If no occupied slot is included in the unexplored slots, this struct was not touched
    if (commonSlots.length === 0) return undefined;

    // If the struct was touched, we might not have all the storage available
    // Usually, we access an entire struct so every occupied slot should be included,
    // but if it was read/modified e.g. with assembly, it could only be partial (?)
    // In such case, we'll just ignore the missing slots and create the object with all available members (later we might want to fetch missing storage from the contract)
    return {
      struct: decodeStructMembers(
        extractedMembers.map((member) => ({
          slot: member.slot,
          current: member.data,
          params: member.params,
          next: nextStorage[member.slot],
        })),
      ),
      slots: extractedMembers.map((member) => member.slot),
      label: item.label,
      type: (types[item.type] as SolcStorageLayoutStructType).label,
      offset: item.offset,
      kind: "struct" as const,
    };
  });

  // Return two objects (current and next)
  return Object.fromEntries(
    structsWithOccupiedSlots
      .filter((struct) => struct !== undefined)
      .map(({ struct, ...rest }) => [
        rest.label,
        omitZeroOffset({
          trace: Object.entries(struct).reduce(
            (acc, [label, value]) => {
              if (!value) return acc;
              acc.current[label] = value.current;
              if (value.next && value.next !== value.current) {
                acc.next[label] = value.next;
              }

              return acc;
            },
            { current: {}, next: {} } as { current: Record<string, unknown>; next: Record<string, unknown> },
          ),
          ...rest,
        }) as LabeledStorageAccess<typeof rest.label, `struct ${string}`, T>,
      ]),
  );
};
/**
 * Extracts and organizes struct member data from storage slots
 *
 * @param storageData - Object mapping slot addresses to their hex data
 * @param baseSlot - The starting slot of the struct
 * @param baseOffset - The offset within the starting slot
 * @param members - Array of struct members with their types and sizes
 * @param types - Type definitions from the storage layout
 * @returns Organized data by slot with member information
 */
export const extractStructMembers = <T extends SolcStorageLayoutTypes>(
  storageData: Record<Hex, Hex>,
  baseSlot: string | number | bigint,
  baseOffset: number,
  members: Array<{ label: string; type: string; offset: number; slot?: string }>,
  types: T,
) => {
  const baseSlotBigInt = BigInt(baseSlot);
  const slotSize = 32; // 32 bytes per slot

  // Initialize result structure
  const result: {
    [slot: string]: {
      slotHex: Hex;
      data: Hex | undefined;
      members: Array<{
        name: string;
        type: string;
        offset: number;
        size: number;
        slotOffset: number; // Relative to the base slot
      }>;
    };
  } = {};

  // Process each member
  let currentSlotOffset = 0;
  let currentOffset = baseOffset;

  members.forEach((member) => {
    const typeInfo = types[member.type as keyof T] as SolcStorageLayoutTypeBase;
    if (!typeInfo) throw new Error(`Type information not found for ${member.type}`);

    const memberSize = Number(typeInfo.numberOfBytes);

    // Check if this member needs to start in a new slot
    // This happens if it doesn't fit in the current slot or if it's a special type
    if (
      // Current slot doesn't have enough space
      currentOffset + memberSize > slotSize ||
      // Dynamic types or reference types always start at a new slot
      typeInfo.encoding === "dynamic_array" ||
      typeInfo.encoding === "bytes" ||
      typeInfo.encoding === "mapping" ||
      // Structs that don't fit in the remaining space start at a new slot
      (typeInfo.label.startsWith("struct") && currentOffset % slotSize !== 0 && memberSize > slotSize - currentOffset)
    ) {
      // Move to the next slot and reset offset within slot
      currentSlotOffset++;
      currentOffset = 0;
    }

    // Calculate the actual slot for this member
    const memberSlot = toHex(baseSlotBigInt + BigInt(currentSlotOffset), { size: 32 });

    // Initialize the slot in our result if it doesn't exist
    if (!result[memberSlot]) {
      result[memberSlot] = {
        slotHex: memberSlot,
        data: storageData[memberSlot], // will be undefined if not in the trace
        members: [],
      };
    }

    // Add this member to the appropriate slot
    result[memberSlot].members.push({
      name: member.label,
      type: member.type,
      offset: currentOffset,
      size: memberSize,
      slotOffset: currentSlotOffset,
    });

    // Update the offset for the next member
    currentOffset += memberSize;

    // If we've filled the current slot, move to the next one
    if (currentOffset >= slotSize) {
      currentSlotOffset += Math.floor(currentOffset / slotSize);
      currentOffset = currentOffset % slotSize;
    }
  });

  // Prepare the data for decodeAbiParameters
  // For each slot, create a tuple of the members in that slot
  const decodableSlots = Object.values(result).map((slot) => {
    // For each slot, we'll create parameter definitions for decodeAbiParameters
    const paramTypes = slot.members.map((member) => {
      const typeInfo = types[member.type as keyof T] as SolcStorageLayoutInplaceType;
      // Convert Solidity type to ABI type
      let abiType = typeInfo.label;

      // Handle special cases for ABI encoding
      if (typeInfo.encoding === "inplace") {
        // For basic types, we can use the label directly
        // But we need to extract the correct portion of the slot data
        return {
          name: member.name,
          type: abiType,
          offset: member.offset,
          size: member.size,
        };
      } else {
        // TODO: handle complex types; idea is to be able to recursively handle based on all the handlers/decoders we have
        return {
          name: member.name,
          type: abiType,
          offset: member.offset,
          size: member.size,
        };
      }
    });

    return {
      slot: slot.slotHex,
      data: slot.data,
      params: paramTypes,
    };
  });

  return decodableSlots;
};

/**
 * Decodes the struct members from the organized slot data
 *
 * @param slotData - Organized slot data with member information
 * @param types - Type definitions from the storage layout
 * @returns Decoded struct as an object
 */
const decodeStructMembers = (
  slotData: Array<{
    slot: Hex;
    current: Hex | undefined;
    next: Hex | undefined;
    params: Array<{
      name: string;
      type: string;
      offset: number;
      size: number;
    }>;
  }>,
) => {
  const result: Record<string, { current: unknown; next?: unknown } | undefined> = {};

  slotData.forEach((slot) => {
    // We're decoding each member separately instead of decoding the whole struct at once to account for the potential initial slot offset
    slot.params.forEach((param) => {
      const decode = (hex: Hex) => {
        try {
          // Extract the relevant portion of the slot data for this member
          const extractedHex = extractRelevantHex(hex, param.offset, param.size);
          return decodeAbiParameters([{ type: param.type }], extractedHex)[0];
        } catch (error) {
          debug(`Error decoding ${param.name} of type ${param.type}:`, error);
          return undefined;
        }
      };

      const currentHex = slot.current;
      const nextHex = slot.next && slot.next !== slot.current ? slot.next : undefined;

      if (!currentHex) return undefined;
      result[param.name] = {
        current: decode(currentHex),
        next: nextHex ? decode(nextHex) : undefined,
      };
    });
  });

  return result;
};

/* ---------------------------------- BYTES --------------------------------- */
const handleBytes = <T extends SolcStorageLayoutTypes>(
  storageTrace: StorageDiff,
  bytes: Array<SolcStorageLayoutItem<T>>,
  types: T,
  unexploredSlots: Set<Hex>,
) => {
  // We don't filter by unexplored slots yet because the bytes might have changed but its length not
  const decodedBytes = bytes.map((item) => decodeBytes(storageTrace, item, types, unexploredSlots));
  // Filter out undefined results (where we couldn't decode the bytes)
  return Object.fromEntries(
    decodedBytes
      .filter((result): result is NonNullable<typeof result> => result !== undefined)
      .map((bytes) => [
        bytes.label,
        omitZeroOffset(bytes) as LabeledStorageAccess<typeof bytes.label, "bytes" | "string", T>,
      ]),
  );
};

const decodeBytes = <T extends SolcStorageLayoutTypes>(
  storageTrace: StorageDiff,
  item: SolcStorageLayoutItem<T>,
  types: T,
  unexploredSlots: Set<Hex>,
):
  | {
      trace: { current: string; next?: string };
      slots: Hex[];
      label: string;
      type: string;
      offset: number;
      kind: "bytes";
    }
  | undefined => {
  const baseSlot = toHex(BigInt(item.slot), { size: 32 });
  const baseSlotData = storageTrace[baseSlot];

  if (!baseSlotData) return undefined;

  // Get the current and next length of the bytes
  const currentLength = getBytesLength(baseSlotData.current);
  const nextLength = baseSlotData.next ? getBytesLength(baseSlotData.next) : undefined;

  // Use the maximum length to determine all slots we need to check
  const maxLength = Math.max(currentLength, nextLength || 0);

  // Early return for empty bytes
  if (maxLength === 0) {
    // Check if the base slot is in unexplored slots
    if (!unexploredSlots.has(baseSlot)) return undefined;

    return {
      trace: {
        current: "",
        next: nextLength !== undefined && nextLength !== currentLength ? "" : undefined,
      },
      slots: [baseSlot],
      label: item.label,
      type: (types[item.type] as SolcStorageLayoutBytesType).label,
      offset: item.offset,
      kind: "bytes" as const,
    };
  }

  // Calculate how many slots this bytes occupies
  const slotsNeeded = Math.ceil(maxLength / 32);

  // Get all slots that should contain this bytes data
  const occupiedSlots: Hex[] = [baseSlot];

  // For long bytes, add the data slots
  if (maxLength >= 32) {
    const baseHash = keccak256(baseSlot);
    for (let i = 0; i < slotsNeeded; i++) {
      const dataSlot = toHex(hexToBigInt(baseHash) + BigInt(i), { size: 32 });
      occupiedSlots.push(dataSlot);
    }
  }

  // Check if any of the required slots are missing from the trace
  for (const slot of occupiedSlots) {
    if (!storageTrace[slot]) {
      debug(`Missing slot ${slot} for bytes at ${baseSlot}`);
      return undefined;
    }
  }

  // Check if any of the occupied slots are in the unexplored slots
  let hasRelevantSlot = false;
  for (const slot of occupiedSlots) {
    if (unexploredSlots.has(slot)) {
      hasRelevantSlot = true;
      break;
    }
  }

  if (!hasRelevantSlot) return undefined;

  // Extract the current bytes data
  const currentBytes = extractBytesData(storageTrace, baseSlot, currentLength);

  // Extract the next bytes data if it exists and is different
  const nextBytes =
    nextLength !== undefined && nextLength !== currentLength
      ? extractBytesData(storageTrace, baseSlot, nextLength, true)
      : undefined;

  // Determine which slots are relevant (in unexplored slots)
  const relevantSlots = occupiedSlots.filter((slot) => unexploredSlots.has(slot));

  // Determine if this is a string or bytes type
  const typeInfo = types[item.type] as SolcStorageLayoutBytesType;
  const isString = typeInfo.label === "string";

  return {
    trace: {
      current: isString ? hexToString(currentBytes) : currentBytes,
      next: nextBytes !== undefined ? (isString ? hexToString(nextBytes) : nextBytes) : undefined,
    },
    slots: relevantSlots,
    label: item.label,
    type: typeInfo.label,
    offset: item.offset,
    kind: "bytes" as const,
  };
};

/** Extracts the length of a bytes/string from its storage slot */
const getBytesLength = (slotData: Hex): number => {
  const slotValue = hexToBigInt(slotData);

  // Check if the bytes is long (lowest bit is set)
  if (slotValue & 1n) {
    // Long bytes: length is (value - 1) / 2
    return Number((slotValue - 1n) >> 1n);
  } else {
    // Short bytes: length is value / 2
    return Number(slotValue >> 1n);
  }
};

/** Extracts bytes data from storage slots */
const extractBytesData = (storageTrace: StorageDiff, baseSlot: Hex, length: number, useNext: boolean = false): Hex => {
  // Handle empty bytes
  if (length === 0) return "0x" as Hex;

  const slotData = useNext ? storageTrace[baseSlot].next! : storageTrace[baseSlot].current;

  // Check if this is a short bytes (< 32 bytes)
  if (length < 32) {
    // For short bytes, the data is stored in the higher-order bytes
    // Remove 0x prefix, then take the first (length * 2) characters
    const hexWithoutPrefix = slotData.slice(2);
    // The data is left-aligned, so we take from the beginning
    return `0x${hexWithoutPrefix.slice(0, length * 2)}` as Hex;
  } else {
    // For long bytes, the data is stored starting at keccak256(slot)
    const dataSlots: string[] = [];
    const slotsNeeded = Math.ceil(length / 32);
    const baseHash = keccak256(baseSlot);

    for (let i = 0; i < slotsNeeded; i++) {
      const dataSlot = toHex(hexToBigInt(baseHash) + BigInt(i), { size: 32 });
      const slotData = useNext ? storageTrace[dataSlot].next! : storageTrace[dataSlot].current;
      // Remove 0x prefix for concatenation
      dataSlots.push(slotData.slice(2));
    }

    // Concatenate all data and trim to the correct length
    const fullDataHex = dataSlots.join("");
    // Trim to the exact length needed
    return `0x${fullDataHex.slice(0, length * 2)}` as Hex;
  }
};

/* -------------------------------------------------------------------------- */
/*                                    UTILS                                   */
/* -------------------------------------------------------------------------- */
/**
 * Extract relevant hex from a hex string based on its offset and length, especially useful for packed variables
 *
 * @param {Hex} data - The hex string
 * @param {number} offset - The offset in bytes from the right where the value starts
 * @param {number} length - The length in bytes of the value to extract
 * @returns {Hex} - The extracted hex substring padded to 32 bytes
 */
const extractRelevantHex = (data: Hex, offset: number, length: number): Hex => {
  if (!data.startsWith("0x")) data = `0x${data}`;
  if (data === "0x" || data === "0x00") return padHex("0x00", { size: 32 });

  // Fill up to 32 bytes
  data = padHex(data, { size: 32, dir: "left" });

  // Calculate start and end positions (in hex characters)
  // Each byte is 2 hex characters, and we need to account for '0x' prefix
  const totalLength = (data.length - 2) / 2; // Length in bytes (excluding 0x prefix)

  // Calculate offset from left
  const offsetFromLeft = totalLength - offset - length;

  // Calculate character positions
  const startPos = offsetFromLeft * 2 + 2; // +2 for '0x' prefix
  const endPos = startPos + length * 2;

  // Extract the substring and add 0x prefix
  return padHex(`0x${data.slice(startPos, endPos)}`, { size: 32 });
};

// A helper function to omit zero offsets
const omitZeroOffset = (obj: any) => {
  const { offset, ...rest } = obj;
  return offset ? { ...rest, offset } : rest;
};
