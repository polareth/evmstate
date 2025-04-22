import { Address, decodeAbiParameters, encodeAbiParameters, Hex, isAddress, isHex, keccak256, toHex } from "tevm";
import { abi } from "@shazow/whatsabi";
import { AbiType, AbiTypeToPrimitiveType } from "abitype";
import { padHex } from "viem";

import { MappingKey } from "@/lib/explore/types";

/**
 * Sort candidate keys to prioritize addresses first. Passed keys here are padded to 32 bytes.
 *
 * This is important because addresses are the most common key types in mappings. Modified to avoid unnecessary array
 * copy.
 */
export const sortCandidateKeys = (keys: Hex[]): Hex[] => {
  // Group keys by likelihood of being addresses (more efficient than sorting)
  const addressLikeKeys: Hex[] = [];
  const otherKeys: Hex[] = [];

  // Single pass grouping
  for (const key of keys) {
    if (key.startsWith("0x00000000000000000000") && isAddress(`0x${key.slice(26)}`)) {
      addressLikeKeys.push(key);
    } else {
      otherKeys.push(key);
    }
  }

  // Combine groups (address-like keys first)
  return [...addressLikeKeys, ...otherKeys];
};

/** Compute a mapping slot directly */
export const computeMappingSlot = (keyHex: Hex, baseSlot: Hex): Hex =>
  keccak256(`0x${keyHex.slice(2)}${baseSlot.slice(2)}`);

/**
 * At some point we might want to improve for smart stack exploration to retrieve likely keys. But this is super tricky due to the fact the stack & memory can be literally anything.
 * Typical access patterns:
*
* Mapping
*
* - KECCAK256 → SLOAD/SSTORE
* - -> Slot calculation: keccak256(abi.encode(key, uint256(mappingSlot)))
* - -> key is the input to the hash so we might even be able to retrieve the slot and compare directly
* - KECCAK256 → KECCAK256 → SLOAD/SSTORE
* - -> Slot calculation: keccak256(abi.encode(key2, keccak256(abi.encode(key1, uint256(mappingSlot)))))
* - -> same here we get each key from each keccak input
*
* Array
*
* - KECCAK256 → ADD → SLOAD/SSTORE
* - -> Slot calculation: keccak256(uint256(arraySlot)) + index
*
* As reference:
*
* - Struct in array: KECCAK256 → ADD → ADD → SLOAD/SSTORE Slot calculation: (keccak256(uint256(arraySlot)) + index) +
*   memberOffset
* - Mapping to Struct with Mapping: KECCAK256 → ADD → KECCAK256 → SLOAD/SSTORE Slot calculation:
*   keccak256(abi.encode(key2, (keccak256(abi.encode(key1, uint256(mappingSlot))) + memberOffset)))
*/
/** Extract values from a transaction trace that might be used as mapping keys */
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

            if (type && type !== "string" && type !== "bytes") {
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

          if (type && type !== "string" && type !== "bytes") {
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
