import { Hex, keccak256, MemoryClient, toHex } from "tevm";
import { SolcStorageLayout } from "tevm/bundler/solc";
import { isHex, padHex } from "viem";

import { DeepReadonly } from "@/lib/explore/types";
import { StorageAccessTrace } from "@/lib/trace/types";

export const getClient = (): MemoryClient => {
  // @ts-expect-error no index signature
  return globalThis.client;
};

export const getSlotHex = (slot: number | bigint) => {
  return toHex(slot, { size: 32 });
};

export const getMappingSlotHex = (slot: Hex | number, ...keys: Hex[]) => {
  let currentSlot = isHex(slot) ? slot : getSlotHex(slot);

  for (const key of keys) {
    const paddedKey = padHex(key, { size: 32 });
    currentSlot = keccak256(`0x${paddedKey.replace("0x", "")}${currentSlot.replace("0x", "")}`);
  }

  return currentSlot;
};

export const getArraySlotHex = ({
  slot,
  index,
  size = 32,
  isDynamic = true,
}: {
  slot: Hex | bigint | number;
  index: bigint | number;
  size?: number;
  isDynamic?: boolean;
}) => {
  const slotBigInt = BigInt(slot);
  const indexBigInt = BigInt(index);

  if (isDynamic) {
    return getDynamicSlotDataHex(slot, index);
  } else {
    if (size <= 0 || size > 32) throw new Error(`Invalid size ${size}`);
    // slot + index
    const elementsPerSlot = 32n / BigInt(size); // Integer division
    const slotOffset = indexBigInt / elementsPerSlot; // Integer division
    return toHex(slotBigInt + slotOffset, { size: 32 });
  }
};

export const getDynamicSlotDataHex = (slot: Hex | number | bigint, offset: number | bigint) => {
  // keccak256(slot) + index
  const baseSlotHex = isHex(slot) ? slot : toHex(slot, { size: 32 });
  const dataStartSlot = keccak256(baseSlotHex);
  return toHex(BigInt(dataStartSlot) + BigInt(offset), { size: 32 });
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
