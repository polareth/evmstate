import { Address, BlockTag, createMemoryClient, decodeAbiParameters, Hex, http } from "tevm";
import { Common } from "tevm/common";
import { padHex } from "viem";

import { debug } from "@/debug";
import { AbiType, AbiTypeToPrimitiveType, StaticAbiType, staticAbiTypeToByteLength } from "@/lib/schema";
import { MappingKey } from "@/lib/types";

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
 * Decode a hex string padded to 32 bytes based on its Solidity type
 *
 * @param valueHex The hex value to decode
 * @param type The Solidity type (e.g., 'uint256', 'bool', 'address')
 * @param offset The offset of the variable within the slot (for packed variables)
 * @returns The decoded value with the appropriate JavaScript type
 */
export const decodeHex = <T extends AbiType = AbiType>(
  valueHex: Hex,
  type?: T,
  offset?: number,
): { hex: Hex; decoded?: AbiTypeToPrimitiveType<T> } => {
  if (!type) return { hex: valueHex };

  try {
    const byteLength = staticAbiTypeToByteLength[type as StaticAbiType]; // TODO: there is no way we get a dynamic type here, right?

    // Extract the relevant part of the storage slot
    const extractedHex = extractRelevantHex(valueHex, offset ?? 0, byteLength);
    const decoded = decodeAbiParameters([{ type }], padHex(extractedHex, { size: 32 }))[0] as AbiTypeToPrimitiveType<T>;

    return { hex: extractedHex, decoded };
  } catch (error) {
    debug(`Error decoding storage value of type ${type}:`, error);
    return { hex: valueHex };
  }
};

/**
 * Extract relevant hex from a hex string based on its offset and length, especially useful for packed variables
 *
 * @param {Hex} data - The 32-byte hex string
 * @param {number} offset - The offset in bytes from the right where the value starts
 * @param {number} length - The length in bytes of the value to extract
 * @returns {Hex} - The extracted hex substring
 */
const extractRelevantHex = (data: Hex, offset: number, length: number): Hex => {
  if (!data.startsWith("0x")) data = `0x${data}`;
  if (data === "0x" || data === "0x00") return data;

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
  return `0x${data.slice(startPos, endPos)}`;
};
