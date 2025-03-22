import { Address, Hex, hexToBigInt, isHex, keccak256, toHex } from "tevm";
import { abi } from "@shazow/whatsabi";
import { padHex } from "viem";

import { AbiType } from "@/lib/schema";
import { PotentialKey, SlotLabelResult, StorageSlotInfo } from "@/lib/types";

/**
 * A slot computation engine that implements Solidity's storage layout rules to accurately compute and label storage
 * slots.
 */

/**
 * Computes the storage slot for a mapping given the base slot and key
 *
 * `keccak256(abi.encode(key, slot))
 */
export const computeMappingSlot = (baseSlot: Hex, key: PotentialKey): Hex =>
  keccak256(`0x${key.padded.replace("0x", "")}${baseSlot.replace("0x", "")}`);

/**
 * Computes the storage slot for a nested mapping with arbitrary depth
 *
 * `keccak256(abi.encode(key1, keccak256(abi.encode(key2, slot))))` etc
 */
export const computeNestedMappingSlot = (baseSlot: Hex, keys: Array<PotentialKey>): Hex => {
  // Return early if no keys
  if (!keys.length) return baseSlot;

  let slot = baseSlot;
  // Recursively apply mapping hash for each key
  keys.forEach((key) => (slot = computeMappingSlot(slot, key))); // we don't care about the type

  return slot;
};

/**
 * Computes the storage slot for a dynamic array element
 *
 * `keccak256(slot) + index`
 */
export const computeArraySlot = (baseSlot: Hex, index: bigint): Hex => {
  const slotBigInt = hexToBigInt(keccak256(baseSlot));
  return toHex(slotBigInt + index, { size: 32 }); // TODO: is this correct? Will we be able to convert back to bigint to add offset then back to hex?
};

/** Extract values from a transaction trace that might be used as keys or indices */
export const extractPotentialKeys = (
  trace: {
    uniqueStackValues?: Array<string>;
    relevantOps?: Array<{
      op: string;
      stack: Array<string>;
    }>;
  },
  addresses: Array<Address>,
  abis: Array<abi.ABIFunction>,
  txData?: Hex,
): PotentialKey[] => {
  const keys: PotentialKey[] = [];

  // Add touched addresses
  addresses.forEach((address) => {
    keys.push({
      padded: padHex(address, { size: 32 }),
      type: "address",
    });
  });

  // Extract raw function arguments if data is present
  if (txData && txData.length >= 10) {
    // Retrieve the function call from the abis
    const selector = txData.slice(0, 10);
    const functionCall = abis.find((fn) => fn.selector === selector);

    // Extract parameters (each parameter is 32 bytes / 64 hex chars)
    const paramLength = (txData.length - 10) / 64;
    for (let i = 0; i < paramLength; i++) {
      const paramStart = 10 + i * 64;
      const paramEnd = paramStart + 64;
      const param = txData.slice(paramStart, paramEnd);

      keys.push({
        padded: `0x${param}`, // already padded to 32 bytes
        type: functionCall?.inputs?.[i].type as AbiType | undefined,
      });
    }
  }

  // Process stack values from the trace
  if (trace.uniqueStackValues?.length) {
    // Process unique stack values directly
    for (const stackValue of trace.uniqueStackValues) {
      keys.push({
        padded: isHex(stackValue) ? padHex(stackValue, { size: 32 }) : toHex(stackValue, { size: 32 }),
        type: undefined,
      });
    }
  }

  // Deduplicate keys
  const uniqueMap = new Map();
  // Add the new key only if it's not already in the map (and don't replace a key with a defined type)
  keys.forEach((k) => {
    if (!uniqueMap.has(k.padded) || k.type) uniqueMap.set(k.padded, k);
  });

  return Array.from(uniqueMap.values());
};

/** Finds all matching labels for a storage slot, including packed variables */
// TODO: for mappings, this is most likely not correct at all but confused rn; each type points to another type so we should be able to recursively
// find out each next's type to produce the full mapping flow
// - We should probably first create any mapping flow when there are multiple ones, then test with every potential key
// - We can also filter out keys that have a type that does not fit each mapping's keyType
export const findLayoutInfoAtSlot = (
  slot: Hex,
  storageLayout: StorageSlotInfo[],
  potentialKeys: PotentialKey[],
): SlotLabelResult[] => {
  const results: SlotLabelResult[] = [];

  // No storage layout, provide generic fallback
  if (storageLayout.length === 0) {
    return [
      {
        label: `var_${slot.slice(0, 10)}`,
        slot: slot,
        matchType: "exact",
        type: undefined,
      },
    ];
  }

  // 1. Check for all direct variable matches at this slot (packed or unpacked)
  const directSlots = storageLayout.filter((item) => !item.isComputed);

  // Group variables by slot to identify packed variables
  const slotToInfo = new Map<Hex, Set<StorageSlotInfo>>();

  for (const directSlot of directSlots) {
    if (!slotToInfo.has(directSlot.slot)) slotToInfo.set(directSlot.slot, new Set());
    slotToInfo.get(directSlot.slot)!.add(directSlot);
  }

  // If we have any direct matches for this slot
  if (slotToInfo.has(slot)) {
    const matching = Array.from(slotToInfo.get(slot)!);
    // Sort by offset to ensure consistent order (helps when there are packed variables)
    matching.sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));

    // Add all variables at this slot to results
    const results = matching.map((match) => ({
      label: match.label,
      slot: slot,
      matchType: "exact" as const,
      type: match.type,
      offset: match.offset,
    }));

    // If we found direct matches, we can return immediately
    if (results.length > 0) return results;
  }

  // 2. Check for mapping slot matches
  const mappings = storageLayout.filter(
    (item) =>
      item.encoding === "mapping" &&
      // Skip nested mappings for this pass
      // TODO: we can probably do both mappings & nested mappings in the same pass
      !item.valueType?.includes("mapping"),
  );
  for (const mapping of mappings) {
    potentialKeys.forEach((key) => {
      const computedSlot = computeMappingSlot(mapping.slot, key);

      // If the slot computed with this potential key matches the target slot, add it to results
      if (computedSlot === slot) {
        results.push({
          label: mapping.label,
          slot: slot,
          matchType: "mapping",
          // TODO: there is something to do here with nested mappings as some type should be a mapping and not just a type
          type: mapping.valueType,
          keys: [key],
        });
      }
    });
  }

  // 3. Check for nested mapping matches (up to any depth, but starting with 2 levels)
  const nestedMappings = mappings.filter((m) => m.valueType?.includes("mapping"));
  for (const mapping of nestedMappings) {
    // First try two levels of nesting (most common case)
    // TODO: see above, not only we can probably just do a recursive function, where everytime valueType is a mapping we call again, but also this is just probably purely unnecessary
    potentialKeys.forEach((key1) => {
      potentialKeys.forEach((key2) => {
        if (key1 === key2) return;

        const keys = [key1, key2];
        const computedSlot = computeNestedMappingSlot(mapping.slot, keys);

        if (computedSlot === slot) {
          results.push({
            label: mapping.label,
            slot,
            matchType: "nested-mapping",
            type: mapping.valueType,
            keys,
          });
        }
      });
    });
  }

  // 4. Check for dynamic array slot matches
  const arrays = storageLayout.filter((item) => item.encoding === "dynamic_array");
  for (const array of arrays) {
    potentialKeys.forEach((key) => {
      // Skip values that can't be reasonable array indices
      if (!isValidArrayIndex(key.padded)) return;

      const index = hexToBigInt(key.padded);
      const computedSlot = computeArraySlot(array.slot, index);

      if (computedSlot === slot) {
        results.push({
          label: array.label,
          slot: slot,
          matchType: "array",
          type: array.baseType,
          index: key.padded,
        });
      }
    });
  }

  // 5. Fallback: use a generic variable name for small slot numbers if no results so far
  if (results.length === 0) {
    return [
      {
        label: `var_${slot.slice(0, 10)}`,
        slot: slot,
        matchType: "exact",
        type: undefined,
      },
    ];
  }

  return results;
};

/** Checks if a value can be used as an array index */
export const isValidArrayIndex = (index: Hex): boolean => {
  const LIMIT = 1_000_000n; // TODO: what is a reasonable limit for array indexes?
  const indexBigInt = hexToBigInt(index);
  return indexBigInt >= 0n && indexBigInt < LIMIT;
};
