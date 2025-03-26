import { Hex, keccak256, MemoryClient, toHex } from "tevm";
import { padHex } from "viem";

export const getClient = (): MemoryClient => {
  // @ts-expect-error no index signature
  return globalThis.client;
};

export const getSlotHex = (slot: number) => {
  return toHex(slot, { size: 32 });
};

export const getMappingSlotHex = (slot: number, ...keys: Hex[]) => {
  let currentSlot = getSlotHex(slot);

  for (const key of keys) {
    const paddedKey = padHex(key, { size: 32 });
    currentSlot = keccak256(`0x${paddedKey.replace("0x", "")}${currentSlot.replace("0x", "")}`);
  }

  return currentSlot;
};
