import { Address, Hex, hexToBigInt, isHex, keccak256, toHex } from "tevm";
import { abi } from "@shazow/whatsabi";
import { decodeAbiParameters, encodeAbiParameters, padHex } from "viem";

import { AbiType, AbiTypeToPrimitiveType } from "@/lib/layout/schema";
import { MappingKey, SlotLabelResult, StorageSlotInfo } from "@/lib/types";

// Maximum nesting depth to prevent excessive recursion
const NESTED_MAPPINGS_LIMIT = 5; // TODO: what would be reasonable? Maybe let consumer override it?

/**
 * A slot computation engine that implements Solidity's storage layout rules to accurately compute and label storage
 * slots.
 */

/**
 * Computes the storage slot for a mapping given the base slot and key
 *
 * `keccak256(abi.encode(key, slot))
 */
export const computeMappingSlot = (baseSlot: Hex, key: MappingKey): Hex =>
  keccak256(`0x${key.hex.replace("0x", "")}${baseSlot.replace("0x", "")}`);

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
  abiFunctions: Array<abi.ABIFunction>,
  txData?: Hex,
): MappingKey[] => {
  const keys: MappingKey[] = [];

  // Add touched addresses
  addresses.forEach((address) => {
    keys.push({
      hex: padHex(address, { size: 32 }),
      decoded: address,
      type: "address",
    });
  });

  // Extract parameters from transaction data
  if (txData && txData.length > 10) {
    const selector = txData.slice(0, 10);
    const inputs = abiFunctions.find((fn) => fn.selector === selector)?.inputs;

    if (inputs) {
      // Decode function inputs
      const params = decodeAbiParameters(inputs, `0x${txData.slice(10)}`);

      params.forEach((param, index) => {
        // If it's an array, add each element as a key
        if (Array.isArray(param)) {
          param.forEach((p) => {
            const type = inputs[index].type.replace("[]", "") as AbiType;

            if (type) {
              keys.push({
                hex: padHex(encodeAbiParameters([{ type }], [p]), { size: 32 }),
                decoded: p as AbiTypeToPrimitiveType<typeof type>,
                type,
              });
            }
          });
        } else {
          // Otherwise just add the key straight up
          const type = inputs[index].type as AbiType;

          if (type) {
            keys.push({
              hex: padHex(encodeAbiParameters([{ type }], [param]), { size: 32 }),
              decoded: param as AbiTypeToPrimitiveType<typeof type>,
              type,
            });
          }
        }
      });
    }
  }

  // Process stack values from the trace
  if (trace.uniqueStackValues?.length) {
    // Process unique stack values directly
    for (const stackValue of trace.uniqueStackValues) {
      keys.push({
        hex: isHex(stackValue) ? padHex(stackValue, { size: 32 }) : toHex(stackValue, { size: 32 }),
        type: undefined,
      });
    }
  }

  // Deduplicate keys
  const uniqueMap = new Map();
  // Add the new key only if it's not already in the map (and don't replace a key with a defined type)
  keys.forEach((k) => {
    if (!uniqueMap.has(k.hex) || k.type) uniqueMap.set(k.hex, k);
  });

  return Array.from(uniqueMap.values()).sort((a, b) => {
    // prefer address as it's more likely to be a key
    if (a.type === "address") return -1;
    if (b.type === "address") return 1;
    // prefer defined types
    if (a.type === undefined) return 1;
    if (b.type === undefined) return -1;

    return 0;
  });
};

/**
 * Parse a mapping type string to extract key types and final value type
 *
 * Example: "mapping(address => mapping(uint256 => bool))" returns { keyTypes: ["address", "uint256"], finalValueType:
 * "bool" }
 */
const parseMultiMappingType = (type: AbiType): { keyTypes: AbiType[]; finalValueType: AbiType } => {
  const keyTypes: AbiType[] = [];
  let remainingType = type;

  // Extract mapping key types until we reach the final value type
  while (remainingType.startsWith("mapping(")) {
    // Extract the key type (between "mapping(" and " =>")
    const keyMatch = remainingType.match(/mapping\(([^=]+)=>/);
    if (!keyMatch) break;

    const keyType = keyMatch[1].trim() as AbiType;
    keyTypes.push(keyType);

    // Remove the processed part
    remainingType = remainingType.substring(remainingType.indexOf("=>") + 2).trim() as AbiType;

    // If remaining type doesn't start with "mapping", it's the final value type
    if (!remainingType.startsWith("mapping")) {
      const finalValueType = remainingType.replace(/\)+$/, "").trim() as AbiType;
      return { keyTypes, finalValueType };
    }
  }

  // Default if we couldn't parse properly
  const finalValueType = type.replace(/^mapping\([^=]+=>\s*|\)+$/g, "") as AbiType;
  return { keyTypes, finalValueType };
};

/** Finds all matching labels for a storage slot, including packed variables */
export const findLayoutInfoAtSlot = (
  slot: Hex,
  storageLayout: StorageSlotInfo[],
  potentialKeys: MappingKey[],
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

  // 2. Check for mapping and nested mapping slot matches with unified approach
  const mappings = storageLayout.filter((item) => item.encoding === "mapping");

  for (const mapping of mappings) {
    // For each mapping, we need to determine if it's a nested mapping and how many levels of nesting it has
    const isNestedMapping = mapping.valueType?.includes("mapping") ?? false;

    // Parse the mapping type to get all key types and final value type
    const { keyTypes, finalValueType } =
      isNestedMapping && mapping.valueType
        ? parseMultiMappingType(mapping.valueType)
        : { keyTypes: [], finalValueType: mapping.valueType };

    // Get keys by type for more efficient lookup
    const keysByType: Record<string, MappingKey[]> = {};
    potentialKeys.forEach((key) => {
      if (key.type) keysByType[key.type] = (keysByType[key.type] ?? []).concat(key);
    });

    // Get keys that match the mapping's key type first
    const keyType1 = mapping.keyType as AbiType;
    const firstLevelKeys = keysByType[keyType1] || [];

    // For nested mappings with arbitrary depth, use a recursive approach
    if (isNestedMapping) {
      // This recursive function tries all valid combinations of keys at each nesting level
      const findNestedMappingMatch = (
        currentSlot: Hex, // Current slot we're computing from
        currentLevel: number, // Current nesting level (1-indexed)
        usedKeys: Array<MappingKey>, // Keys we've used so far
        allKeyTypes: Array<AbiType | undefined>, // All key types from outer to inner
      ): boolean => {
        // Stop if we reached our depth limit
        if (currentLevel > NESTED_MAPPINGS_LIMIT) return false;

        // If we have a match, add it to results and stop
        if (currentSlot === slot) {
          // Only accept if we have the right number of keys for this level
          if (usedKeys.length === currentLevel - 1) {
            results.push({
              label: mapping.label,
              slot,
              matchType: "nested-mapping",
              type: finalValueType,
              keys: usedKeys,
            });

            return true; // found a match!
          }
          return false;
        }

        // If we've gone through all key types but no match, stop
        if (currentLevel > allKeyTypes.length) return false;

        // Get the current level's key type
        const currentKeyType = currentLevel === 1 ? mapping.keyType : allKeyTypes[currentLevel - 2]; // -2 because level is 1-indexed and first level uses mapping.keyType

        // Optimization: for specific types, only use keys that match the type
        // This reduces the search space significantly
        let levelKeys: MappingKey[];

        if (currentKeyType) {
          // Use keys with matching type if available
          const typedKeys = keysByType[currentKeyType as string];
          if (typedKeys && typedKeys.length > 0) {
            levelKeys = typedKeys;
          } else {
            // Fall back to untyped keys if needed
            levelKeys = potentialKeys.filter((key) => !key.type || key.type === currentKeyType);
          }
        } else {
          // If no type is specified, use all available keys
          levelKeys = potentialKeys;
        }

        // Sort keys to prioritize those matching the expected type
        const sortedKeys = [...levelKeys].sort((a, b) => {
          // Prioritize keys with the exact matching type
          if (a.type === currentKeyType && b.type !== currentKeyType) return -1;
          if (a.type !== currentKeyType && b.type === currentKeyType) return 1;
          // Then prioritize keys with any type over undefined
          if (a.type && !b.type) return -1;
          if (!a.type && b.type) return 1;

          return 0;
        });

        // Try each key for this level
        for (const key of sortedKeys) {
          // Skip if we've already used this key
          if (usedKeys.some((usedKey) => usedKey.hex === key.hex)) continue;

          // Compute the next slot using this key
          const nextSlot = computeMappingSlot(currentSlot, key);

          // Early exit on direct match (common case for 2-level nesting)
          if (nextSlot === slot) {
            const updatedKeys = [...usedKeys, key];
            results.push({
              label: mapping.label,
              slot,
              matchType: "nested-mapping",
              type: finalValueType,
              keys: updatedKeys,
            });
            return true;
          }

          // Only go deeper if we haven't reached the maximum nesting level
          // and if we still have key types to process
          if (currentLevel < allKeyTypes.length && currentLevel < NESTED_MAPPINGS_LIMIT) {
            // Add this key to our path
            const updatedKeys = [...usedKeys, key];

            // Continue to the next level
            const found = findNestedMappingMatch(nextSlot, currentLevel + 1, updatedKeys, allKeyTypes);
            // If we found a match, no need to try other keys
            if (found) return true;
          }
        }

        // Didn't find a match with any key combination
        return false;
      };

      // Build the array of all key types (first is already handled by mapping.keyType)
      const allKeyTypes = [mapping.keyType, ...keyTypes];

      // Start the recursive process with the base slot
      findNestedMappingMatch(mapping.slot, 1, [], allKeyTypes);
    } else {
      // Simple mapping - try each compatible key
      firstLevelKeys.forEach((key) => {
        const computedSlot = computeMappingSlot(mapping.slot, key);

        if (computedSlot === slot) {
          results.push({
            label: mapping.label,
            slot,
            matchType: "mapping",
            type: mapping.valueType,
            keys: [key],
          });
        }
      });
    }
  }

  // 3. Check for dynamic array slot matches
  const arrays = storageLayout.filter((item) => item.encoding === "dynamic_array");
  for (const array of arrays) {
    potentialKeys.forEach((key) => {
      // Skip values that can't be reasonable array indices
      if (!isValidArrayIndex(key.hex)) return;

      const index = hexToBigInt(key.hex);
      const computedSlot = computeArraySlot(array.slot, index);

      if (computedSlot === slot) {
        results.push({
          label: array.label,
          slot: slot,
          matchType: "array",
          type: array.baseType,
          index: key.hex,
        });
      }
    });
  }

  // 4. Fallback: use a generic variable name if no results so far
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
