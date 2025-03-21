import { Address, Hex, keccak256 } from "tevm";

import { SlotLabelResult, StorageSlotInfo, TraceValue } from "@/lib/types";

/**
 * A slot computation engine that implements Solidity's storage layout rules
 * to accurately compute and label storage slots.
 */

// TODO: review (entire file)

/**
 * Computes the storage slot for a mapping given the base slot and key
 */
export function computeMappingSlot(
  baseSlot: string | number | bigint,
  key: string | number | bigint,
  keyType: string = "address",
): string {
  // Normalize inputs to strings
  const slotBigInt = typeof baseSlot === "bigint" ? baseSlot : BigInt(baseSlot.toString());

  // Normalize and pad the key based on its type
  let paddedKey: string;

  if (typeof key === "string" && key.startsWith("0x")) {
    // Handle hex string inputs (addresses, bytes, etc.)
    const cleanKey = key.slice(2).toLowerCase().padStart(64, "0");
    paddedKey = cleanKey;
  } else if (keyType.includes("address")) {
    // Handle address type
    let hexKey = typeof key === "string" && key.startsWith("0x") ? key.slice(2) : key.toString(16);

    paddedKey = hexKey.toLowerCase().padStart(64, "0");
  } else if (keyType.includes("uint") || keyType.includes("int")) {
    // Handle integer types
    const numKey = BigInt(key.toString());
    paddedKey = numKey.toString(16).padStart(64, "0");
  } else {
    // Default case
    paddedKey = key.toString().padStart(64, "0");
  }

  // Pad the slot number to 32 bytes
  const paddedSlot = slotBigInt.toString(16).padStart(64, "0");

  // Concatenate the key and slot for hashing
  const dataToHash = paddedKey + paddedSlot;

  // Compute keccak256 hash
  const hash = keccak256(`0x${dataToHash}`);

  return "0x" + hash;
}

/**
 * Computes the storage slot for a nested mapping with arbitrary depth
 */
export function computeNestedMappingSlot(
  baseSlot: string | number | bigint,
  keys: Array<string | number | bigint>,
  keyTypes: Array<string | undefined> = [],
): string {
  // Return early if no keys
  if (!keys.length) {
    return typeof baseSlot === "string" ? baseSlot : "0x" + BigInt(baseSlot).toString(16);
  }

  // Start with the base slot
  let slot = baseSlot;

  // Recursively apply mapping hash for each key
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const keyType = keyTypes[i] || "address"; // Default to address if type not provided
    slot = computeMappingSlot(slot, key, keyType);
  }

  return slot.toString();
}

/**
 * Computes the storage slot for a dynamic array element
 */
export function computeArraySlot(baseSlot: string | number | bigint, index: string | number | bigint): string {
  // Normalize parameters
  const slotBigInt = typeof baseSlot === "bigint" ? baseSlot : BigInt(baseSlot.toString());

  const indexBigInt = typeof index === "bigint" ? index : BigInt(index.toString());

  // For dynamic arrays, Solidity stores data at keccak256(slot) + index
  const paddedSlot = slotBigInt.toString(16).padStart(64, "0");

  // Compute keccak256 hash of the base slot
  const hash = keccak256(`0x${paddedSlot}`);

  // Convert the hash to a slot number and add the index
  const hashBigInt = BigInt("0x" + hash);
  const resultSlot = hashBigInt + indexBigInt;

  return "0x" + resultSlot.toString(16);
}

/**
 * Extract potential values from a transaction trace that might be used as keys or indices
 */
export function extractPotentialValuesFromTrace(
  trace:
    | {
        uniqueStackValues?: Array<string>;
        relevantOps?: Array<{
          op: string;
          stack: Array<string>;
        }>;
      }
    | Array<{
        op: string;
        stack: Array<string>;
      }>,
  txData: {
    from?: Address;
    to?: Address;
    data?: Hex;
  },
): TraceValue[] {
  const values: TraceValue[] = [];

  // Add transaction-level values
  if (txData.from) {
    values.push({
      value: txData.from,
      source: "address",
      position: 0,
      operation: "FROM",
    });
  }

  if (txData.to) {
    values.push({
      value: txData.to,
      source: "address",
      position: 1,
      operation: "TO",
    });
  }

  // Add common constants that might be used as array indices
  for (let i = 0; i < 10; i++) {
    values.push({
      value: i,
      source: "constant",
      position: i,
      operation: "CONST",
    });
  }

  // Extract raw function arguments if data is present
  if (txData.data && txData.data.length >= 10) {
    // Function selector is first 4 bytes (0x + 8 chars)
    const selector = txData.data.slice(0, 10);

    // Extract parameters (each parameter is 32 bytes / 64 hex chars)
    const paramLength = (txData.data.length - 10) / 64;
    for (let i = 0; i < paramLength; i++) {
      const paramStart = 10 + i * 64;
      const paramEnd = paramStart + 64;
      const param = txData.data.slice(paramStart, paramEnd);

      values.push({
        value: param,
        source: "argument",
        position: i,
        operation: "ARG",
      });

      // Try to interpret the parameter in different ways

      // As address (if it looks like a padded address)
      if (param.startsWith("0x000000000000000000000000")) {
        const possibleAddress = "0x" + param.slice(26);
        values.push({
          value: possibleAddress,
          source: "argument",
          position: i,
          operation: "ADDRESS_ARG",
        });
      }

      // As number
      try {
        const numValue = BigInt(param);
        if (numValue < 2n ** 128n) {
          // Filter out very large numbers that are likely hashes
          values.push({
            value: numValue,
            source: "argument",
            position: i,
            operation: "NUMBER_ARG",
          });
        }
      } catch (error) {
        // Not a number, ignore
      }
    }
  }

  // Process stack values from the trace
  if ("uniqueStackValues" in trace && Array.isArray(trace.uniqueStackValues)) {
    // Process unique stack values directly
    for (const stackValue of trace.uniqueStackValues) {
      try {
        const numValue = BigInt(stackValue);
        if (numValue < 2n ** 128n) {
          values.push({
            value: stackValue,
            source: "stack",
            operation: "STACK",
          });
        }
      } catch (error) {
        // Not a valid number, add it anyway as it might be a non-numeric key
        values.push({
          value: stackValue,
          source: "stack",
          operation: "STACK",
        });
      }
    }
  } else if (Array.isArray(trace)) {
    // Process the full trace
    for (const step of trace) {
      if (step.stack && step.stack.length > 0) {
        // Focus on likely key values (filter out very large numbers)
        for (const stackValue of step.stack) {
          try {
            const numValue = BigInt(stackValue);
            if (numValue < 2n ** 128n) {
              values.push({
                value: stackValue,
                source: "stack",
                operation: step.op,
              });
            }
          } catch (error) {
            // Not a valid number, add it anyway
            values.push({
              value: stackValue,
              source: "stack",
              operation: step.op,
            });
          }
        }
      }
    }
  }

  // Deduplicate values
  const uniqueMap = new Map();

  for (const v of values) {
    // Create a unique key for deduplication
    let keyValue;
    if (typeof v.value === "bigint") {
      keyValue = v.value.toString();
    } else {
      keyValue = String(v.value);
    }

    const key = `${keyValue}::${v.source}::${v.operation}`;
    uniqueMap.set(key, v);
  }

  return Array.from(uniqueMap.values());
}

/**
 * Finds all matching labels for a storage slot, including packed variables
 */
export function findBestStorageSlotLabel(
  slot: string,
  storageLayout: StorageSlotInfo[],
  potentialValues: TraceValue[],
): SlotLabelResult[] {
  // Normalize slot for consistent comparison
  const normalizedSlot = normalizeSlot(slot);
  const results: SlotLabelResult[] = [];

  // No storage layout, provide generic fallback
  if (!storageLayout || storageLayout.length === 0) {
    const slotNum = parseInt(normalizedSlot.replace(/^0x/, ""), 16);
    if (slotNum >= 0 && slotNum < 100) {
      // Increased range for fallback labels
      results.push({
        label: `var${slotNum}`,
        slot: normalizedSlot,
        matchType: "exact",
        type: "uint256", // Default type for unknown slots
        keys: [],
        keySources: [],
      });
      return results;
    }
    return results;
  }

  // 1. Check for all direct variable matches at this slot (packed or unpacked)
  const directSlots = storageLayout.filter((item) => !item.isComputed);
  
  // Group variables by slot to identify packed variables
  const slotToVariables = new Map<string, StorageSlotInfo[]>();
  
  for (const directSlot of directSlots) {
    const normalizedDirectSlot = normalizeSlot(directSlot.slot);
    if (!slotToVariables.has(normalizedDirectSlot)) {
      slotToVariables.set(normalizedDirectSlot, []);
    }
    slotToVariables.get(normalizedDirectSlot)?.push(directSlot);
  }
  
  // If we have any direct matches for this slot
  if (slotToVariables.has(normalizedSlot)) {
    const matchingVariables = slotToVariables.get(normalizedSlot)!;
    
    // Sort by offset to ensure consistent order (helps when there are packed variables)
    matchingVariables.sort((a, b) => {
      const offsetA = 'offset' in a ? a.offset || 0 : 0;
      const offsetB = 'offset' in b ? b.offset || 0 : 0;
      return offsetA - offsetB;
    });
    
    // Add all variables at this slot to results
    for (const variable of matchingVariables) {
      results.push({
        label: variable.label || `var${parseInt(normalizedSlot.replace(/^0x/, ""), 16)}`,
        slot: slot,
        matchType: "exact",
        type: variable.type,
        keys: [],
        keySources: [],
        offset: 'offset' in variable ? variable.offset : undefined
      });
    }
    
    // If we found direct matches, we can return immediately
    if (results.length > 0) {
      return results;
    }
  }

  // 2. Check for mapping slot matches
  const mappings = storageLayout.filter((item) => item.encoding === "mapping" && item.baseSlot !== undefined);

  for (const mapping of mappings) {
    // Skip if no base slot
    if (!mapping.baseSlot) continue;

    // Skip nested mappings in first pass
    const isNestedMapping = mapping.valueType?.includes("mapping");
    if (isNestedMapping) continue;

    for (const keyValue of potentialValues) {
      try {
        const computedSlot = computeMappingSlot(mapping.baseSlot, keyValue.value, mapping.keyType);

        if (normalizeSlot(computedSlot) === normalizedSlot) {
          results.push({
            label: `${mapping.label}[${formatKey(keyValue.value, mapping.keyType)}]`,
            slot: slot,
            matchType: "mapping",
            type: mapping.valueType,
            keys: [keyValue.value],
            keySources: [keyValue],
          });
        }
      } catch (error) {
        // Skip this combination if computation fails
        console.error("Error computing mapping slot:", error);
      }
    }
  }

  // 3. Check for nested mapping matches (up to any depth, but starting with 2 levels)
  const nestedMappings = mappings.filter((m) => m.valueType?.includes("mapping"));

  for (const mapping of nestedMappings) {
    if (!mapping.baseSlot) continue;

    // First try two levels of nesting (most common case)
    for (let i = 0; i < potentialValues.length; i++) {
      for (let j = 0; j < potentialValues.length; j++) {
        // Skip if same index
        if (i === j) continue;

        const key1 = potentialValues[i];
        const key2 = potentialValues[j];
        const keys = [key1.value, key2.value];
        const keySources = [key1, key2];
        const keyTypes = [mapping.keyType, "address"]; // Simplified assumption for nested key type

        try {
          const computedSlot = computeNestedMappingSlot(mapping.baseSlot, keys, keyTypes);

          if (normalizeSlot(computedSlot) === normalizedSlot) {
            // Create a formatted label with the appropriate number of brackets
            const formattedKeys = keys.map((k, idx) => formatKey(k, keyTypes[idx] || undefined));
            const label = `${mapping.label}[${formattedKeys.join("][")}]`;

            results.push({
              label,
              slot,
              matchType: "nested-mapping",
              type: mapping.valueType,
              keys,
              keySources,
            });
          }
        } catch (error) {
          // Skip this combination if computation fails
          console.error("Error computing nested mapping slot:", error);
        }
      }
    }

    // TODO: Try three levels of nesting if needed
    // This would require nested loops which could get expensive
    // Implement if required and with performance considerations
  }

  // 4. Check for dynamic array slot matches
  const arrays = storageLayout.filter((item) => item.encoding === "dynamic_array" && item.baseSlot !== undefined);

  for (const array of arrays) {
    if (!array.baseSlot) continue;

    for (const indexValue of potentialValues) {
      // Skip values that can't be array indices
      if (!isValidArrayIndex(indexValue.value)) continue;

      try {
        const index = Number(BigInt(indexValue.value.toString()));
        const computedSlot = computeArraySlot(array.baseSlot, index);

        if (normalizeSlot(computedSlot) === normalizedSlot) {
          results.push({
            label: `${array.label}[${index}]`,
            slot: slot,
            matchType: "array",
            type: array.baseType,
            keys: [index],
            keySources: [indexValue],
          });
        }
      } catch (error) {
        // Skip this combination if computation fails
        console.error("Error computing array slot:", error);
      }
    }
  }

  // 5. Fallback: use a generic variable name for small slot numbers if no results so far
  if (results.length === 0) {
    const slotNum = parseInt(normalizedSlot.replace(/^0x/, ""), 16);
    if (slotNum >= 0 && slotNum < 100) {
      results.push({
        label: `var${slotNum}`,
        slot: slot,
        matchType: "exact",
        type: "uint256", // Default type for unknown slots
        keys: [],
        keySources: [],
      });
    }
  }

  return results;
}

/**
 * Formats a key value for display based on its type
 */
function formatKey(key: any, type?: string): string {
  if (key === undefined || key === null) return "unknown";

  // Format hex strings (addresses, bytes)
  if (typeof key === "string" && key.startsWith("0x")) {
    // For addresses, show a shortened version
    if (type?.includes("address")) {
      return key.slice(0, 10) + "...";
    }
    return key.slice(0, 10) + "...";
  }

  // Format numbers
  if (typeof key === "number" || typeof key === "bigint" || (typeof key === "string" && !isNaN(Number(key)))) {
    return key.toString();
  }

  // Default case
  return String(key);
}

/**
 * Checks if a value can be used as an array index
 */
function isValidArrayIndex(value: any): boolean {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return true;
  }

  if (typeof value === "bigint" && value >= 0n) {
    return true;
  }

  if (typeof value === "string") {
    // If it's a hex string, convert to number
    if (value.startsWith("0x")) {
      try {
        const num = Number(BigInt(value));
        return Number.isInteger(num) && num >= 0 && num < 1000000; // Reasonable limit
      } catch {
        return false;
      }
    }

    // If it's a number string
    const num = Number(value);
    return !isNaN(num) && Number.isInteger(num) && num >= 0 && num < 1000000;
  }

  return false;
}

/**
 * Normalizes a slot value to a consistent format for comparison
 */
function normalizeSlot(slot: string): string {
  if (!slot) return "0x0";

  // Convert to lowercase and ensure 0x prefix
  let normalized = slot.toLowerCase();
  if (!normalized.startsWith("0x")) {
    normalized = "0x" + normalized;
  }

  // Remove leading zeros after 0x prefix
  let cleanSlot = normalized.replace(/^0x0+/, "0x");
  if (cleanSlot === "0x") cleanSlot = "0x0";

  return cleanSlot;
}
