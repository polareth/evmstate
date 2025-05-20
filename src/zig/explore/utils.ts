import { decodeAbiParameters, toHex, type Hex } from "tevm";
import { padHex, type ByteArray, type ToHexParameters } from "viem";

import type { DecodedResult, SolidityTypeToTsType } from "@/lib/explore/types.js";
import { type SolcStorageLayoutTypes } from "@/lib/solc.js";
import { logger } from "@/logger.js";

export const max = <T extends bigint | number>(...nums: Array<T>): T =>
  // @ts-expect-error bigint/number
  nums.reduce((max, num) => (num > max ? num : max), -Infinity);

/**
 * Decodes the 'current'/'next' for a single slot as a primitive field. Returns { currentValue, nextValue? } if data is
 * found, else null.
 */
export const decodeSlotDiffForPrimitive = (
  storageDiff: Record<Hex, { current?: Hex; next?: Hex }>,
  slotHex: Hex,
  typeInfo: { label: string; numberOfBytes: string },
  offsetBytes: bigint,
): { current: DecodedResult["current"]; next?: DecodedResult["next"] } | undefined => {
  if (!storageDiff[slotHex]) return undefined;
  const { current: currentHex, next: nextHex } = storageDiff[slotHex];

  const current = currentHex ? decodePrimitiveField(typeInfo, currentHex, offsetBytes) : undefined;
  if (current === undefined || current.decoded === undefined) {
    logger.error(`Failed to decode primitive field ${typeInfo.label} at slot ${slotHex}`);
    return undefined;
  }

  const next = nextHex ? decodePrimitiveField(typeInfo, nextHex, offsetBytes) : undefined;
  if (!next || next.decoded === undefined) {
    return { current };
  } else {
    return { current, next };
  }
};

/** Decodes a primitive field in a single slot portion, including offset. */
const decodePrimitiveField = <T extends string, Types extends SolcStorageLayoutTypes>(
  typeInfo: { label: T; numberOfBytes: string },
  slotHexData: Hex,
  offsetBytes: bigint,
): { decoded?: SolidityTypeToTsType<T, Types>; hex: Hex } => {
  const valType = typeInfo.label;
  const sizeBytes = Number(typeInfo.numberOfBytes);
  const isSigned = /^int\d*$/.test(valType);

  const { extracted, padded } = extractRelevantHex(slotHexData, Number(offsetBytes), sizeBytes);

  try {
    // Use the correct decoding approach based on whether the type is signed
    if (isSigned) {
      // For signed integers, we need to handle the sign bit properly
      const value = BigInt(padded);
      const size = sizeBytes;
      const max = (1n << (BigInt(size) * 8n - 1n)) - 1n;

      // If the value is greater than the max positive value, it's negative
      const decodedValue = value <= max ? value : value - BigInt(`0x${"f".padStart(size * 2, "f")}`) - 1n;

      return { decoded: decodedValue as SolidityTypeToTsType<T, Types>, hex: extracted };
    } else {
      // For unsigned types, use the standard decoding
      return {
        decoded: decodeAbiParameters([{ type: valType }], padded)[0] as SolidityTypeToTsType<T, Types>,
        hex: extracted,
      };
    }
  } catch {
    return { hex: padded };
  }
};

/**
 * Extract relevant hex from a hex string based on its offset and length, especially useful for packed variables
 *
 * @param {Hex} data - The hex string
 * @param {number} offset - The offset in bytes from the right where the value starts
 * @param {number} length - The length in bytes of the value to extract
 * @returns {Hex} - The extracted hex substring padded to 32 bytes
 */
const extractRelevantHex = (data: Hex, offset: number, length: number): { extracted: Hex; padded: Hex } => {
  try {
    if (!data.startsWith("0x")) data = `0x${data}`;
    if (data === "0x" || data === "0x00") return { extracted: "0x00", padded: padHex(data, { size: 32 }) };

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
    const extracted = `0x${data.slice(startPos, endPos)}` as Hex;

    return { extracted, padded: padHex(extracted, { size: 32 }) };
  } catch {
    logger.error(`Failed to extract relevant hex from ${data} at offset ${offset} with length ${length}`);
    return { extracted: data, padded: padHex(data, { size: 32 }) };
  }
};

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
