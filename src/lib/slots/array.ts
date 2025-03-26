import { Hex, hexToBigInt, keccak256, toHex } from "tevm";

/**
 * Computes the storage slot for a dynamic array element
 *
 * - `keccak256(slot) + index` for dynamic arrays
 * - `slot + index` for static arrays
 */
export const computeArraySlot = (baseSlot: Hex, index: bigint | number | string, isDynamic = true): Hex => {
  if (isDynamic) {
    const baseSlotHash = keccak256(baseSlot);
    const slotBigInt = hexToBigInt(baseSlotHash);
    return toHex(slotBigInt + BigInt(index), { size: 32 });
  } else {
    const slotBigInt = hexToBigInt(baseSlot);
    return toHex(slotBigInt + BigInt(index), { size: 32 });
  }
};
