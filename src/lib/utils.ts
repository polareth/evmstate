import { Address, BlockTag, createMemoryClient, Hex, http } from "tevm";
import { Common } from "tevm/common";

import { AbiType } from "@/lib/types/schema";

/** Creates a Tevm client from the provided options */
export const createClient = (options: { rpcUrl?: string; common?: Common; blockTag?: BlockTag | bigint }) => {
  const { rpcUrl, common, blockTag } = options;
  if (!rpcUrl) throw new Error("You need to provide a rpcUrl if you don't provide a client directly");

  return createMemoryClient({
    common,
    fork: {
      transport: http(rpcUrl),
      blockTag: blockTag ?? "latest",
    },
    miningConfig: { type: "manual" },
  });
};

export const uniqueAddresses = (addresses: Array<Address | undefined>): Array<Address> => {
  let existingAddresses = new Set<string>();

  return addresses.filter((address) => {
    if (!address || existingAddresses.has(address.toLowerCase())) return false;
    existingAddresses.add(address.toLowerCase());
    return true;
  }) as Address[];
};

/**
 * Decode a hex string value based on its Solidity type
 *
 * @param hexValue The hex value to decode
 * @param type The Solidity type (e.g., 'uint256', 'bool', 'address')
 * @param offset The offset of the variable within the slot (for packed variables)
 * @returns The decoded value with the appropriate JavaScript type
 */
// TODO: review
export function decodeStorageValue(hexValue: Hex, type?: AbiType, offset?: number): any {
  if (!type) return hexValue;
  const cleanHex = hexValue.startsWith("0x") ? hexValue : `0x${hexValue}`;

  try {
    // For packed values, extract the relevant part of the storage slot
    let valueToProcess = cleanHex;

    if (offset !== undefined) {
      const fullValue = BigInt(cleanHex);
      let bitOffset = offset * 8; // Convert byte offset to bit offset
      let bitSize = 256; // Default full slot

      // Determine bit size based on type
      if (type.startsWith("uint") || type.startsWith("int")) {
        const matches = type.match(/\d+/);
        if (matches && matches[0]) {
          bitSize = parseInt(matches[0]);
        }
      } else if (type === "bool") {
        bitSize = 8; // Booleans use 8 bits in storage
      } else if (type === "address") {
        bitSize = 160; // Addresses are 20 bytes (160 bits)
      } else if (type.startsWith("bytes") && type.length > 5) {
        const matches = type.match(/\d+/);
        if (matches && matches[0]) {
          bitSize = parseInt(matches[0]) * 8; // bytesN uses N*8 bits
        }
      }

      // Create a bitmask for the specified size
      const mask = (1n << BigInt(bitSize)) - 1n;

      // Shift and mask to extract the value
      const extractedValue = (fullValue >> BigInt(bitOffset)) & mask;

      // Convert back to hex for further processing
      valueToProcess = "0x" + extractedValue.toString(16);
    }

    // Handle boolean
    if (type === "bool") {
      return valueToProcess === "0x" || valueToProcess === "0x0" || valueToProcess === "0x00" ? false : true;
    }

    // Handle address
    if (type === "address") {
      // Ensure proper address format (0x + 40 hex chars)
      if (valueToProcess.length <= 42) {
        // Add the 0x prefix if needed
        const withPrefix = valueToProcess.startsWith("0x") ? valueToProcess : `0x${valueToProcess}`;
        // Remove 0x, pad with leading zeros, then add 0x back
        const addressHex = withPrefix.replace(/^0x/, "");
        return `0x${addressHex.padStart(40, "0")}`.toLowerCase();
      } else {
        // If it's longer than 42 chars, take the last 40 chars
        return `0x${valueToProcess.slice(valueToProcess.length - 40)}`.toLowerCase();
      }
    }

    // Handle integers (uint/int variants)
    if (type.startsWith("uint") || type.startsWith("int")) {
      const bigIntValue = BigInt(valueToProcess || "0");

      // For smaller integers that fit in regular JavaScript numbers, return as number
      if (
        type.includes("8") ||
        type.includes("16") ||
        type.includes("24") ||
        type.includes("32") ||
        type.includes("40") ||
        type.includes("48")
      ) {
        return Number(bigIntValue);
      }

      // For larger integers, return as bigint
      return bigIntValue;
    }

    // Handle bytes
    if (type.startsWith("bytes") && type.length > 5) {
      // Fixed-size bytes (bytes1 to bytes32)
      return valueToProcess;
    }

    if (type === "bytes" || type === "string") {
      // Dynamic bytes or string - attempt to decode as UTF-8 string if it looks like text
      if (type === "string") {
        try {
          // Remove the 0x prefix
          let hexString = valueToProcess.startsWith("0x") ? valueToProcess.slice(2) : valueToProcess;

          // Skip if it's just zeros
          if (/^0*$/.test(hexString)) return "";

          // Remove trailing zeros (often used as padding)
          hexString = hexString.replace(/0+$/, "");

          // Convert hex pairs to bytes
          const bytes = [];
          for (let i = 0; i < hexString.length; i += 2) {
            bytes.push(parseInt(hexString.substring(i, i + 2), 16));
          }

          // Convert bytes to string
          const decoded = new TextDecoder().decode(new Uint8Array(bytes));

          // If the decoded string looks valid (contains printable chars), return it
          if (/^[\x20-\x7E]*$/.test(decoded)) {
            return decoded;
          }
        } catch (e) {
          // Fallback to hex on decoding error
        }
      }

      return valueToProcess;
    }

    // Handle array types
    if (type.endsWith("[]")) {
      // For arrays, we would need array length information which isn't easily available from the hex value
      // Returning the raw hex for now
      return valueToProcess;
    }

    // Default fallback - return as hex
    return valueToProcess;
  } catch (error) {
    console.error(`Error decoding storage value of type ${type}:`, error);
    return hexValue;
  }
}
