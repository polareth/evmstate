import { Hex, keccak256, MemoryClient, toHex } from "tevm";
import { SolcStorageLayout } from "tevm/bundler/solc";
import { ByteArray, isHex, padHex, ToHexParameters } from "viem";

import { DeepReadonly } from "@/lib/explore/types";
import { StorageAccessTrace, TraceStorageAccessTxWithAbi } from "@/lib/trace/types";

export const getClient = (): MemoryClient => {
  // @ts-expect-error no index signature
  return globalThis.client;
};

export const getSlotHex = (slot: number) => {
  return toHex(slot, { size: 32 });
};

/**
 * Converts a value to a hex string and ensures it has an even number of bytes
 *
 * @param value The value to convert to hex
 * @param options Optional configuration options passed to tevm's toHex
 * @returns A hex string with an even number of bytes
 */
export const toEvenHex = (value: string | number | bigint | boolean | ByteArray, opts?: ToHexParameters): Hex => {
  // Use tevm's toHex function
  const hex = toHex(value, opts);

  // If the hex string has an odd number of characters after the 0x prefix,
  // pad it with a leading zero to make it even
  if ((hex.length - 2) % 2 !== 0) return ("0x0" + hex.slice(2)) as Hex;
  return hex;
};

export const getMappingSlotHex = (slot: Hex | number, ...keys: Hex[]) => {
  let currentSlot = isHex(slot) ? slot : getSlotHex(slot);

  for (const key of keys) {
    const paddedKey = padHex(key, { size: 32 });
    currentSlot = keccak256(`0x${paddedKey.replace("0x", "")}${currentSlot.replace("0x", "")}`);
  }

  return currentSlot;
};

export const getArraySlotHex = (slot: Hex | number, index: Hex | bigint | number, isDynamic = true) => {
  const slotBigInt = BigInt(slot);
  const indexBigInt = BigInt(index);

  if (isDynamic) {
    // keccak256(slot) + index
    const baseSlotHex = toHex(slotBigInt, { size: 32 });
    const dataStartSlot = keccak256(baseSlotHex);
    return toHex(BigInt(dataStartSlot) + indexBigInt, { size: 32 });
  } else {
    // slot + index
    // TODO: packed elements, need to account for size & offset
    return toHex(slotBigInt + indexBigInt, { size: 32 });
  }
};

export const getSlotAtOffsetHex = (slot: Hex | number, offset: number) => {
  const slotBigInt = isHex(slot) ? BigInt(slot) : BigInt(slot);
  return toHex(slotBigInt + BigInt(offset), { size: 32 });
};

/**
 * Returns a hex string with the encoded length according to Solidity's string encoding For short strings (< 32 bytes),
 * the string data is stored directly in the slot with the length encoded in the lowest bytes
 *
 * @param str The string to convert to hex
 * @returns A hex string with properly encoded length
 */
export const getStringHex = (str: string): Hex => {
  // Convert string to UTF-8 bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  // Get the byte length
  const length = bytes.length;

  // Convert bytes to hex without 0x prefix
  let bytesHex = "";
  for (let i = 0; i < bytes.length; i++) {
    bytesHex += bytes[i].toString(16).padStart(2, "0");
  }

  // Pad the hex string to fill the slot (32 bytes - 2 bytes for length = 30 bytes)
  // This gives us 60 hex characters for the content
  const paddedHex = bytesHex.padEnd(60, "0");

  // Encode the length (multiply by 2 as per Solidity rules)
  const lengthHex = (length * 2).toString(16).padStart(4, "0");

  return `0x${paddedHex}${lengthHex}` as Hex;
};

/** Helper to type an access trace based on a storage layout */
export const expectedStorage = <StorageLayout extends DeepReadonly<SolcStorageLayout>>(
  _: StorageLayout,
  expectedStorage: Partial<StorageAccessTrace<StorageLayout>["storage"]>,
) => expectedStorage;
