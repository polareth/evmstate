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

/**
 * Waits until a condition function returns true or a timeout is reached.
 *
 * @param condition - The function to evaluate periodically. Should return true when the condition is met.
 * @param options - Optional configuration for timeout and interval.
 * @param options.timeout - The maximum time to wait in milliseconds (default: 5000).
 * @param options.interval - The interval between condition checks in milliseconds (default: 50).
 * @returns A promise that resolves when the condition is met or rejects on timeout or error.
 */
export const waitFor = (
  condition: () => boolean | Promise<boolean>,
  options?: { timeout?: number; interval?: number; throwOnReject?: boolean },
): Promise<void> => {
  const { timeout = 5000, interval = 50, throwOnReject = true } = options ?? {};
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    let intervalId: NodeJS.Timeout | undefined;
    let timeoutId: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const checkCondition = async () => {
      try {
        const result = await condition();
        if (result) {
          cleanup();
          resolve();
        } else if (Date.now() - startTime > timeout) {
          cleanup();
          if (throwOnReject) {
            reject(new Error(`waitFor timed out after ${timeout}ms`));
          } else {
            resolve();
          }
        }
        // Condition not met yet, continue polling
      } catch (error) {
        cleanup();
        reject(error); // Reject if the condition function throws an error
      }
    };

    // Set up the interval to check the condition
    intervalId = setInterval(checkCondition, interval);

    // Set up the timeout
    timeoutId = setTimeout(() => {
      cleanup();
      if (throwOnReject) {
        reject(new Error(`waitFor timed out after ${timeout}ms`));
      } else {
        resolve();
      }
    }, timeout);

    // Initial check immediately
    void checkCondition();
  });
};
