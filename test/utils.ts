import { MemoryClient } from "tevm";
import { toHex } from "viem";

export const getClient = (): MemoryClient => {
  // @ts-expect-error no index signature
  return globalThis.client;
};

export const getSlotHex = (slot: number) => {
  return toHex(slot, { size: 32 });
};
