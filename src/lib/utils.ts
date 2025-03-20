import { Address, Hex } from "tevm";

import { AbiType } from "./types/schema";

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
 * @param hexValue The hex value to decode
 * @param type The Solidity type (e.g., 'uint256', 'bool', 'address')
 * @returns The decoded value with the appropriate JavaScript type
 */
// TODO: review
export function decodeStorageValue(hexValue: Hex, type?: string): any {
  if (!hexValue) return undefined;
  if (!type) return hexValue;

  // Convert to clean hex (no leading zeros)
  const cleanHex = hexValue.startsWith("0x") ? hexValue : `0x${hexValue}`;

  try {
    // Handle boolean
    if (type === "bool") {
      return cleanHex === "0x" || cleanHex === "0x0" || cleanHex === "0x00" ? false : true;
    }

    // Handle address
    if (type === "address") {
      // Ensure proper address format (0x + 40 hex chars)
      return cleanHex.length <= 42
        ? cleanHex.padEnd(42, "0").toLowerCase()
        : `0x${cleanHex.slice(cleanHex.length - 40)}`.toLowerCase();
    }

    // Handle integers (uint/int variants)
    if (type.startsWith("uint") || type.startsWith("int")) {
      const bigIntValue = BigInt(cleanHex || "0");

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
      return cleanHex;
    }

    if (type === "bytes" || type === "string") {
      // Dynamic bytes or string - attempt to decode as UTF-8 string if it looks like text
      if (type === "string") {
        try {
          // Remove the 0x prefix
          let hexString = cleanHex.startsWith("0x") ? cleanHex.slice(2) : cleanHex;

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

      return cleanHex;
    }

    // Handle array types
    if (type.endsWith("[]")) {
      // For arrays, we would need array length information which isn't easily available from the hex value
      // Returning the raw hex for now
      return cleanHex;
    }

    // Default fallback - return as hex
    return cleanHex;
  } catch (error) {
    console.error(`Error decoding storage value of type ${type}:`, error);
    return hexValue;
  }
}
