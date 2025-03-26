import { Address, Hex, hexToBigInt, isHex, keccak256, toHex } from "tevm";
import { abi } from "@shazow/whatsabi";
import { decodeAbiParameters, encodeAbiParameters, padHex } from "viem";

import { isStorageAdapterType, StorageAdapter, StorageLayoutAdapter } from "@/lib/layout/adapter";
import { AbiType, AbiTypeToPrimitiveType } from "@/lib/layout/schema";
import { MappingKey, SlotLabelResult } from "@/lib/types";

// Maximum nesting depth to prevent excessive computation
const NESTED_MAPPINGS_LIMIT = 4;
// Limit the number of explored states to prevent excessive computation
// e.g. with 20 potential keys and a mapping with 2 levels of nesting, there are 20² = 400 possible combinations to check
// -> meaning that the mapping will be fully explored
// with 3 levels of nesting, that jumps to 20³ = 8,000 combinations
// with 4 levels, it would be 20⁴ = 160,000 combinations
// -> meaning that 3 levels would be partially explored, and 4 levels is just too much (this is both pretty rare and unprobable to end up in a match anyway)
// BUT we prioritize address keys, which is the most common key type in mappings, so this is a good compromise
const MAX_EXPLORED_STATES = 5_000;

/**
 * A slot computation engine that implements Solidity's storage layout rules to accurately compute and label storage
 * slots.
 */

/**
 * Computes the storage slot for a mapping given the base slot and key
 *
 * `keccak256(abi.encode(key, slot))
 */
export const computeMappingSlot = (baseSlot: Hex, key: Hex): Hex =>
  keccak256(`0x${key.replace("0x", "")}${baseSlot.replace("0x", "")}`);

/**
 * Computes the storage slot for a dynamic array element
 *
 * - `keccak256(slot) + index` for dynamic arrays
 * - `slot + index` for static arrays
 */
export const computeArraySlot = (baseSlot: Hex, index: bigint | number | string, isDynamic = true): Hex => {
  if (isDynamic) {
    const baseSlotHash = keccak256(baseSlot);
    const slotBigInt = hexToBigInt(baseSlotHash);
    return toHex(slotBigInt + BigInt(index), { size: 32 });
  } else {
    const slotBigInt = hexToBigInt(baseSlot);
    return toHex(slotBigInt + BigInt(index), { size: 32 });
  }
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
 * Finds all matching labels for a storage slot, including packed variables Using the StorageLayoutAdapter approach
 *
 * @param slot The storage slot to find information for
 * @param adapter A storage layout adapter
 * @param potentialKeys Potential mapping keys or array indices from the transaction
 * @returns Array of labeled slot results
 */
export const findLayoutInfoAtSlot = (
  slot: Hex,
  adapter: StorageLayoutAdapter,
  potentialKeys: MappingKey[],
): SlotLabelResult[] => {
  // Get all storage variables
  const variables = Object.values(adapter);

  // 1. Check for all direct variable matches at this slot (packed or unpacked)
  // TODO: if it's a bytes type we're missing some data that is on the next slot, the whole thing is broken (maybe if that's the type iterate slots? the next slots will probably also be marked in the access list)
  const directMatches = variables.filter((v) => v.getSlot() === slot);
  if (directMatches.length > 0) {
    // Return direct matches
    return (
      directMatches
        // Sort by offset to ensure consistent order (helps when there are packed variables)
        .sort((a, b) => (a.storageItem.offset ?? 0) - (b.storageItem.offset ?? 0))
        .map((v) => ({
          label: v.label,
          slot,
          matchType: "exact",
          type: v.type,
          offset: v.storageItem.offset,
        }))
    );
  }

  // 2. Check for mapping matches
  const mappings = variables.filter(
    isStorageAdapterType.mapping,
  ) as StorageAdapter<`mapping(${string} => ${string})`>[];

  for (const mapping of mappings) {
    // Try to find a match using our unified function
    const slotInfo = findMappingMatch(mapping.label, slot, mapping, potentialKeys, adapter);
    if (slotInfo) return [slotInfo];
  }

  // TODO: 3. Check for array matches
  // -> should actually provide the provider to adapters, so for arrays we can get the length (hope it was not manipulated), and get slots for all existing indexes (+1 in case an item was removed??)
  // TODO: 4. Check for struct matches

  // Process each variable in the adapter for arrays and other types
  // for (const variableName of Object.keys(adapter)) {
  //   try {
  //     const variable = adapter[variableName];
  //     if (!variable || !variable.type) continue;

  //     // CASE 3: Array (static or dynamic)
  //     if (variable.type.includes("[") && potentialKeys.length > 0) {
  //       // For arrays, we need to check if the variable has itemSlot method
  //       if ("getItemSlot" in variable) {
  //         for (const key of potentialKeys) {
  //           if (!key.hex) continue;

  //           // Convert to numeric index if possible
  //           let index: number;
  //           if (key.type === "uint256" && typeof key.decoded === "bigint") {
  //             index = Number(key.decoded);
  //           } else if (isHex(key.hex)) {
  //             index = Number(hexToBigInt(key.hex));
  //           } else {
  //             continue; // Not a valid index
  //           }

  //           // Skip invalid indices
  //           if (isNaN(index) || index < 0 || index > 1_000_000) continue;

  //           try {
  //             // Get the slot for this array index
  //             const itemSlot = (variable as any).getItemSlot({ index });

  //             // Check if it matches our target
  //             if (itemSlot === slot) {
  //               // Extract the base type from the array type (e.g., uint256[] -> uint256)
  //               const baseType = variable.type.match(/^([^\[]+)/)?.[1]?.trim() as AbiType;

  //               results.push({
  //                 label: `${variableName}[${index}]`,
  //                 slot,
  //                 matchType: "array",
  //                 type: baseType || (variable.type as AbiType),
  //                 index: key.hex,
  //               });

  //               break; // One match is enough
  //             }
  //           } catch (e) {
  //             // Skip this index
  //           }
  //         }
  //       }
  //     }
  //   } catch (e) {
  //     // Skip this variable entirely
  //     continue;
  //   }
  // }

  // If no matches found, use generic variable name
  return [
    {
      label: `var_${slot.slice(0, 10)}`,
      slot: slot,
      matchType: "exact",
      type: undefined,
    },
  ];
};

/**
 * Finds a matching mapping key combination that produces the target storage slot. Works with both simple mappings and
 * nested mappings. Uses a straightforward and reliable approach focused on direct slot computation.
 *
 * @param variableName The name of the mapping variable
 * @param targetSlot The storage slot we're trying to match
 * @param mapping The mapping adapter containing type information
 * @param potentialKeys Array of potential keys from transaction data
 * @param adapter The storage layout adapter
 * @returns The SlotLabelResult if a match is found, undefined otherwise
 */
export const findMappingMatch = (
  variableName: string,
  targetSlot: Hex,
  mapping: StorageAdapter<`mapping(${string} => ${string})`>,
  potentialKeys: MappingKey[],
  adapter: StorageLayoutAdapter,
): SlotLabelResult | undefined => {
  // Parse mapping type to understand its structure
  const keyTypes = mapping.keys;
  const valueType = mapping.value;
  const baseSlot = mapping.getSlot();

  // Early termination if we have no keys to try
  if (potentialKeys.length === 0) return undefined;

  // Filter potential keys by their types
  // Address keys are very common in mappings, prioritize them first
  const keysByType: Record<string, MappingKey[]> = {};

  // Group keys by their types
  potentialKeys.forEach((key) => {
    if (key.type) {
      if (!keysByType[key.type]) keysByType[key.type] = [];
      keysByType[key.type].push(key);
    }
  });

  // Check if we have enough address keys for the expected mapping depth
  const addressKeys = keysByType["address"] || [];

  // Special case optimization for nested address => address => ... mappings
  // which is a common pattern in Solidity
  if (keyTypes.every((t) => t === "address") && addressKeys.length >= keyTypes.length) {
    // Try all combinations of address keys with the right count
    if (keyTypes.length === 1) {
      // Single level mapping
      for (const key of addressKeys) {
        const computedSlot = computeMappingSlot(baseSlot, key.hex);
        if (computedSlot === targetSlot) {
          return {
            label: variableName,
            slot: targetSlot,
            matchType: "mapping",
            type: valueType as AbiType,
            keys: [key],
          };
        }
      }
    } else {
      // Try permutations for deeper nested mappings
      // Use the test's specific approach to computing nested slots
      const generatePermutations = (
        keys: MappingKey[],
        used: boolean[],
        current: MappingKey[],
        level: number,
        currentSlot: Hex,
      ): SlotLabelResult | undefined => {
        // Check if we found a match at this level
        if (currentSlot === targetSlot && level === keyTypes.length) {
          return {
            label: variableName,
            slot: targetSlot,
            matchType: "nested-mapping",
            type: valueType as AbiType,
            keys: [...current],
          };
        }

        // If we've used up all levels, stop
        if (level >= keyTypes.length) return undefined;

        // Try each unused key at this level
        for (let i = 0; i < keys.length; i++) {
          if (used[i]) continue;

          // Mark this key as used
          used[i] = true;
          current.push(keys[i]);

          // Compute the next slot
          const nextSlot = computeMappingSlot(currentSlot, keys[i].hex);

          // Check if this gives us the target
          if (nextSlot === targetSlot && level === keyTypes.length - 1) {
            return {
              label: variableName,
              slot: targetSlot,
              matchType: "nested-mapping",
              type: valueType as AbiType,
              keys: [...current],
            };
          }

          // Recurse to the next level
          const result = generatePermutations(keys, used, current, level + 1, nextSlot);
          if (result) return result;

          // Backtrack
          current.pop();
          used[i] = false;
        }

        return undefined;
      };

      // Start with no keys used
      const used = Array(addressKeys.length).fill(false);
      const result = generatePermutations(addressKeys, used, [], 0, baseSlot);
      if (result) return result;
    }
  }

  // For simple mappings with a single key type
  if (keyTypes.length === 1) {
    const expectedKeyType = keyTypes[0];

    // Sort keys by type relevance
    const sortedKeys = [...potentialKeys].sort((a, b) => {
      // Exact type match has highest priority
      if (a.type === expectedKeyType && b.type !== expectedKeyType) return -1;
      if (a.type !== expectedKeyType && b.type === expectedKeyType) return 1;
      // Keys with defined types have next priority
      if (a.type && !b.type) return -1;
      if (!a.type && b.type) return 1;
      return 0;
    });

    // Try direct computation with each key
    for (const key of sortedKeys) {
      const computedSlot = computeMappingSlot(baseSlot, key.hex);

      if (computedSlot === targetSlot) {
        return {
          label: variableName,
          slot: targetSlot,
          matchType: "mapping",
          type: valueType as AbiType,
          keys: [key],
        };
      }
    }
    return undefined;
  }

  // For nested mappings with multiple key types
  // We'll use BFS without adapter calls, focusing on direct computation
  // Track visited states
  const visited = new Set<string>();

  // Queue for BFS
  const queue: Array<{
    level: number; // Current nesting level
    slot: Hex; // Current slot at this level
    keys: MappingKey[]; // Keys used so far
  }> = [{ level: 0, slot: baseSlot, keys: [] }];
  let statesExplored = 0;

  while (queue.length > 0 && statesExplored < MAX_EXPLORED_STATES) {
    const { level, slot, keys } = queue.shift()!;
    statesExplored++;

    // Create a unique state ID
    const stateId = `${slot}-${level}`;
    if (visited.has(stateId)) continue;
    visited.add(stateId);

    // Stop if we've reached the limit
    if (level >= keyTypes.length || level >= NESTED_MAPPINGS_LIMIT) continue;

    // Get expected key type for this level
    const expectedKeyType = keyTypes[level];

    // Filter valid keys for this level
    const candidateKeys = potentialKeys
      .filter((key) => {
        // Don't reuse keys we've already used
        if (keys.some((uk) => uk.hex === key.hex)) return false;

        // Type compatibility check
        if (key.type && expectedKeyType && key.type !== expectedKeyType) {
          // Special case for addresses
          if (!(expectedKeyType === "address" && key.hex.length === 66)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Prioritize by type relevance
        if (a.type === expectedKeyType && b.type !== expectedKeyType) return -1;
        if (a.type !== expectedKeyType && b.type === expectedKeyType) return 1;
        if (a.type && !b.type) return -1;
        if (!a.type && b.type) return 1;
        return 0;
      });

    // Try each key at this level
    for (const key of candidateKeys) {
      // Compute next slot directly - this is the most reliable approach
      const nextSlot = computeMappingSlot(slot, key.hex);

      // Check for direct match
      if (nextSlot === targetSlot) {
        return {
          label: variableName,
          slot: targetSlot,
          matchType: "nested-mapping",
          type: valueType as AbiType,
          keys: [...keys, key],
        };
      }

      // Continue searching if not at max depth
      if (level + 1 < keyTypes.length && level + 1 < NESTED_MAPPINGS_LIMIT) {
        queue.push({
          level: level + 1,
          slot: nextSlot,
          keys: [...keys, key],
        });
      }
    }
  }

  return undefined;
};
