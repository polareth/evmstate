import { Address, Hex, hexToBigInt, isHex, keccak256, toHex } from "tevm";
import { abi } from "@shazow/whatsabi";
import { decodeAbiParameters, encodeAbiParameters, padHex } from "viem";

import { isStorageAdapterType, StorageAdapter, StorageLayoutAdapter } from "@/lib/layout/adapter";
import { AbiType, AbiTypeToPrimitiveType } from "@/lib/layout/schema";
import { MappingKey, SlotLabelResult } from "@/lib/types";

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
 * Finds a matching mapping key combination that produces the target storage slot Works with both simple mappings and
 * nested mappings
 *
 * @param variableName The name of the mapping variable
 * @param targetSlot The storage slot we're trying to match
 * @param mapping The mapping adapter containing type information
 * @param potentialKeys Array of potential keys from transaction data
 * @param adapter The storage layout adapter
 * @param results Array to collect the matching results
 * @returns A boolean indicating if a match was found (results are pushed directly)
 */
export const findMappingMatch = (
  variableName: string,
  targetSlot: Hex,
  mapping: StorageAdapter<`mapping(${string} => ${string})`>,
  potentialKeys: MappingKey[],
  adapter: StorageLayoutAdapter,
): SlotLabelResult | undefined => {
  // Parse mapping type to understand its structure (single or nested)
  const keyTypes = mapping.keys;
  const valueType = mapping.value;
  const baseSlot = mapping.getSlot();

  // Early termination if we have no keys to try
  if (potentialKeys.length === 0) return undefined;

  // For simple mappings with a single key type, we can optimize the search
  if (keyTypes.length === 1) {
    // Try each potential key and see if it produces our target slot
    for (const key of potentialKeys) {
      try {
        const computedSlot = mapping.getSlot({ keys: [key.hex] });
        if (computedSlot === targetSlot) {
          return {
            label: variableName,
            slot: targetSlot,
            matchType: "mapping",
            type: valueType as AbiType,
            keys: [key],
          };
        }
      } catch (e) {
        // Skip this key if there's any error
        continue;
      }
    }
    // No match found for a single mapping
    return undefined;
  }

  /** Inner recursive function to find matching key combinations */
  const findMatch = (
    currentLevel: number,
    currentSlot: Hex,
    usedKeys: Array<MappingKey>,
  ): SlotLabelResult | undefined => {
    // Direct slot match check
    if (currentSlot === targetSlot) {
      return {
        label: variableName,
        slot: targetSlot,
        matchType: usedKeys.length > 0 ? (usedKeys.length > 1 ? "nested-mapping" : "mapping") : "exact",
        type: currentLevel >= keyTypes.length ? (valueType as AbiType) : (mapping.type as AbiType),
        keys: [...usedKeys],
      };
    }

    // Stop recursion if we've reached max depth or used all key types
    if (currentLevel >= keyTypes.length || currentLevel >= NESTED_MAPPINGS_LIMIT) return undefined;

    // Get the expected key type for this level
    const expectedKeyType = keyTypes[currentLevel];

    // Prioritize keys by type compatibility for efficiency
    const prioritizedKeys = potentialKeys
      .filter((key) => {
        // Skip keys we've already used
        if (usedKeys.some((uk) => uk.hex === key.hex)) return false;

        // Skip keys that we know for sure won't match the expected type
        if (key.type && expectedKeyType && key.type !== expectedKeyType) {
          // Special case for addresses which might be formatted differently
          if (!(expectedKeyType === "address" && key.hex.length === 66)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Exact type match has highest priority
        if (a.type === expectedKeyType && b.type !== expectedKeyType) return -1;
        if (a.type !== expectedKeyType && b.type === expectedKeyType) return 1;

        // Keys with defined types have next priority
        if (a.type && !b.type) return -1;
        if (!a.type && b.type) return 1;

        return 0;
      });

    // Try each potential key for this level
    for (const key of prioritizedKeys) {
      try {
        // Create new keys array with this key added
        const keysForThisLevel = [...usedKeys, key];

        try {
          // Use the adapter to compute the next slot
          const variable = adapter[variableName] as StorageAdapter<`mapping(${string} => ${string})`>;
          // @ts-expect-error - We purposely try with unexpected types
          const nextSlot = variable.getSlot({ keys: keysForThisLevel.map((k) => k.hex) });

          // Check for direct match with target slot
          if (nextSlot === targetSlot) {
            return {
              label: variableName,
              slot: targetSlot,
              matchType: keysForThisLevel.length > 1 ? "nested-mapping" : "mapping",
              type: valueType as AbiType,
              keys: keysForThisLevel,
            };
          }

          // If we're not at the final level, recurse to the next level
          if (currentLevel < keyTypes.length - 1) {
            const slotInfo = findMatch(currentLevel + 1, nextSlot, keysForThisLevel);
            if (slotInfo) return slotInfo;
          }
        } catch (e) {
          // Fallback: If adapter fails, use manual Solidity pattern
          // TODO: we probably want to kill this, adapter should always work
          try {
            const nextSlot = computeMappingSlot(currentSlot, key.hex);

            // Check for direct match
            if (nextSlot === targetSlot) {
              return {
                label: variableName,
                slot: targetSlot,
                matchType: keysForThisLevel.length > 1 ? "nested-mapping" : "mapping",
                type: valueType as AbiType,
                keys: keysForThisLevel,
              };
            }

            // Recurse to next level if not at max depth
            if (currentLevel < keyTypes.length - 1) {
              const slotInfo = findMatch(currentLevel + 1, nextSlot, keysForThisLevel);
              if (slotInfo) return slotInfo;
            }
          } catch (innerError) {
            // Both approaches failed, try next key
            continue;
          }
        }
      } catch (error) {
        // Skip this key if any error occurs
        continue;
      }
    }

    // No match found with any key combination
    return undefined;
  };

  // Start the search from the base slot with no keys used
  return findMatch(0, baseSlot, []);
};
