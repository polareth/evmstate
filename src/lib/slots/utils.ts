import { Address, decodeAbiParameters, encodeAbiParameters, Hex, isHex, toHex } from "tevm";
import { abi } from "@shazow/whatsabi";
import { AbiType, AbiTypeToPrimitiveType } from "abitype";
import { padHex } from "viem";

import { MappingKey } from "@/lib/slots/types";

/* -------------------------------------------------------------------------- */
/*                                  MAPPINGS                                  */
/* -------------------------------------------------------------------------- */

/** Extract values from a transaction trace that might be used as mapping keys */
// TODO: refactor to navigate the stack trace and identify both potential keys and array indexes
/**
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

/* -------------------------------------------------------------------------- */
/*                                    UTILS                                   */
/* -------------------------------------------------------------------------- */

/** A helper function to clean up trace objects by removing undefined or zero values */
export const cleanTrace = (obj: any) => {
  const { current, next, note, ...rest } = obj;
  let trace = { ...rest };

  // Only include note if it exists
  if (note) trace.note = note;

  // Same for current and next
  trace.current = { hex: current.hex };
  if (current.decoded !== undefined) trace.current = { hex: current.hex, decoded: current.decoded };

  if (next && rest.modified) {
    trace.next = { hex: next.hex };
    if (next.decoded !== undefined) trace.next = { hex: next.hex, decoded: next.decoded };
  }

  return trace;
};
