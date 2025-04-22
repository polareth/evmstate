import { Hex, toHex } from "tevm";
import { ByteArray, ToHexParameters } from "viem";

export const max = <T extends bigint | number>(...nums: Array<T>): T =>
  // @ts-expect-error bigint/number
  nums.reduce((max, num) => (num > max ? num : max), -Infinity);

/**
 * Converts a value to a hex string and ensures it has an even number of characters (full bytes)
 *
 * @param value The value to convert to hex
 * @param options Optional configuration options passed to tevm's toHex
 * @returns A hex string with full bytes
 */
export const toHexFullBytes = (value: string | number | bigint | boolean | ByteArray, opts?: ToHexParameters): Hex => {
  // Use tevm's toHex function
  const hex = toHex(value, opts);

  // If the hex string has an odd number of characters after the 0x prefix,
  // pad it with a leading zero to make it even
  if ((hex.length - 2) % 2 !== 0) return ("0x0" + hex.slice(2)) as Hex;
  return hex;
};
