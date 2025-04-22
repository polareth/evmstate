import { Address, Hex, toHex } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getClient, getDynamicSlotDataHex, getSlotHex } from "@test/utils";
import { traceStorageAccess } from "@/index";
import { PathSegmentKind } from "@/lib/explore/types";
import { toHexFullBytes } from "@/lib/explore/utils";

const { Bytes } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Bytes and Strings tests
 *
 * This test suite verifies storage access patterns for:
 *
 * 1. Short strings/bytes (<= 31 bytes) stored in a single slot.
 * 2. Long strings/bytes (> 31 bytes) stored across multiple slots (length slot + data slots).
 * 3. Updates between short and long values.
 * 4. Reading and clearing string/bytes values.
 */
describe("Bytes and Strings", () => {
  const shortString = "hello"; // 5 bytes
  const shortBytes: Hex = "0x0102030405"; // 5 bytes
  const shortBytesLength = (shortBytes.length - 2) / 2;
  const longString = "this string is definitely longer than thirty-one bytes"; // 55 bytes
  const longBytes: Hex =
    "0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f3031323334353637"; // 55 bytes
  const longBytesLength = (longBytes.length - 2) / 2;
  const longerString = "this is an even longer string, much more than thirty-one bytes long indeed"; // 76 bytes

  const stringSlot = 0;
  const bytesSlot = 1;

  describe("Short Values (<= 31 bytes)", () => {
    it("should trace setting a short string", async () => {
      const client = getClient();
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [shortString],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(0, { size: 1 }), decoded: 0n },
                next: { hex: toHex(shortString.length, { size: 1 }), decoded: BigInt(shortString.length) },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHex(0, { size: 1 }), decoded: "" },
                next: { hex: toHexFullBytes(shortString), decoded: shortString },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });

    it("should trace getting a short string", async () => {
      const client = getClient();
      // Set value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [shortString],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "getString",
        args: [],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(shortString.length, { size: 1 }), decoded: BigInt(shortString.length) },
                modified: false,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHexFullBytes(shortString), decoded: shortString },
                modified: false,
                slots: [getSlotHex(stringSlot)],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });

    it("should trace setting short bytes", async () => {
      const client = getClient();
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setBytes",
        args: [shortBytes],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myBytes: {
            name: "myBytes",
            type: "bytes",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(0, { size: 1 }), decoded: 0n },
                next: { hex: toHex(shortBytesLength, { size: 1 }), decoded: BigInt(shortBytesLength) },
                modified: true,
                slots: [getSlotHex(bytesSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myBytes._length",
              },
              {
                current: { hex: toHex(0, { size: 1 }), decoded: "0x" },
                next: { hex: shortBytes, decoded: shortBytes },
                modified: true,
                slots: [getSlotHex(bytesSlot)],
                path: [],
                fullExpression: "myBytes",
              },
            ],
          },
        }),
      );
    });

    it("should trace getting short bytes", async () => {
      const client = getClient();
      // Set value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setBytes",
        args: [shortBytes],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "getBytes",
        args: [],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myBytes: {
            name: "myBytes",
            type: "bytes",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(shortBytesLength, { size: 1 }), decoded: BigInt(shortBytesLength) },
                modified: false,
                slots: [getSlotHex(bytesSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myBytes._length",
              },
              {
                current: { hex: shortBytes, decoded: shortBytes },
                modified: false,
                slots: [getSlotHex(bytesSlot)],
                path: [],
                fullExpression: "myBytes",
              },
            ],
          },
        }),
      );
    });

    it("should trace clearing a short string", async () => {
      const client = getClient();
      // Set value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [shortString],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "clearString",
        args: [],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(shortString.length, { size: 1 }), decoded: BigInt(shortString.length) },
                next: { hex: toHex(0, { size: 1 }), decoded: 0n },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHexFullBytes(shortString), decoded: shortString },
                next: { hex: toHex(0, { size: 1 }), decoded: "" },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });
  });

  describe("Long Values (> 31 bytes)", () => {
    it("should trace setting a long string", async () => {
      const client = getClient();
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [longString],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(0, { size: 1 }), decoded: 0n },
                next: { hex: toHex(longString.length, { size: 1 }), decoded: BigInt(longString.length) },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHex(0, { size: 1 }), decoded: "" },
                next: { hex: toHexFullBytes(longString), decoded: longString },
                modified: true,
                slots: [
                  getSlotHex(stringSlot),
                  getDynamicSlotDataHex(stringSlot, 0),
                  getDynamicSlotDataHex(stringSlot, 1),
                ],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });

    it("should trace getting a long string", async () => {
      const client = getClient();
      // Set value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [longString],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "getString",
        args: [],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(longString.length, { size: 1 }), decoded: BigInt(longString.length) },
                modified: false,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHexFullBytes(longString), decoded: longString },
                modified: false,
                slots: [
                  getSlotHex(stringSlot),
                  getDynamicSlotDataHex(stringSlot, 0),
                  getDynamicSlotDataHex(stringSlot, 1),
                ],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });

    it("should trace setting long bytes", async () => {
      const client = getClient();
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setBytes",
        args: [longBytes],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myBytes: {
            name: "myBytes",
            type: "bytes",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(0, { size: 1 }), decoded: 0n },
                next: { hex: toHex(longBytesLength, { size: 1 }), decoded: BigInt(longBytesLength) },
                modified: true,
                slots: [getSlotHex(bytesSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myBytes._length",
              },
              {
                current: { hex: toHex(0, { size: 1 }), decoded: "0x" },
                next: { hex: longBytes, decoded: longBytes },
                modified: true,
                slots: [
                  getSlotHex(bytesSlot),
                  getDynamicSlotDataHex(bytesSlot, 0),
                  getDynamicSlotDataHex(bytesSlot, 1),
                ],
                path: [],
                fullExpression: "myBytes",
              },
            ],
          },
        }),
      );
    });

    it("should trace getting long bytes", async () => {
      const client = getClient();
      // Set value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setBytes",
        args: [longBytes],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "getBytes",
        args: [],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myBytes: {
            name: "myBytes",
            type: "bytes",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(longBytesLength, { size: 1 }), decoded: BigInt(longBytesLength) },
                modified: false,
                slots: [getSlotHex(bytesSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myBytes._length",
              },
              {
                current: { hex: longBytes, decoded: longBytes },
                modified: false,
                slots: [
                  getSlotHex(bytesSlot),
                  getDynamicSlotDataHex(bytesSlot, 0),
                  getDynamicSlotDataHex(bytesSlot, 1),
                ],
                path: [],
                fullExpression: "myBytes",
              },
            ],
          },
        }),
      );
    });

    it("should trace clearing a long string", async () => {
      const client = getClient();
      // Set value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [longString],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "clearString",
        args: [],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(longString.length, { size: 1 }), decoded: BigInt(longString.length) },
                next: { hex: toHex(0, { size: 1 }), decoded: 0n },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHexFullBytes(longString), decoded: longString },
                next: { hex: toHex(0, { size: 1 }), decoded: "" },
                modified: true,
                slots: [
                  getSlotHex(stringSlot),
                  getDynamicSlotDataHex(stringSlot, 0),
                  getDynamicSlotDataHex(stringSlot, 1),
                ],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });
  });

  describe("Transitions", () => {
    it("should trace updating short string to long string", async () => {
      const client = getClient();
      // Set short value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [shortString],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [longString],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(shortString.length, { size: 1 }), decoded: BigInt(shortString.length) },
                next: { hex: toHex(longString.length, { size: 1 }), decoded: BigInt(longString.length) },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHexFullBytes(shortString), decoded: shortString },
                next: { hex: toHexFullBytes(longString), decoded: longString },
                modified: true,
                slots: [
                  getSlotHex(stringSlot),
                  getDynamicSlotDataHex(stringSlot, 0),
                  getDynamicSlotDataHex(stringSlot, 1),
                ],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });

    it("should trace updating long string to short string", async () => {
      const client = getClient();
      // Set long value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [longString],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [shortString],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(longString.length, { size: 1 }), decoded: BigInt(longString.length) },
                next: { hex: toHex(shortString.length, { size: 1 }), decoded: BigInt(shortString.length) },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHexFullBytes(longString), decoded: longString },
                next: { hex: toHexFullBytes(shortString), decoded: shortString },
                modified: true,
                slots: [
                  getSlotHex(stringSlot),
                  getDynamicSlotDataHex(stringSlot, 0),
                  getDynamicSlotDataHex(stringSlot, 1),
                ],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });

    it("should trace updating long string to another long string (different length)", async () => {
      const client = getClient();
      // Set long value first
      await client.tevmContract({
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [longString],
        addToBlockchain: true,
      });

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Bytes.address,
        abi: Bytes.abi,
        functionName: "setString",
        args: [longerString],
      });

      expect(trace[Bytes.address.toLowerCase() as Address].storage).toEqual(
        expectedStorage(LAYOUTS.Bytes, {
          myString: {
            name: "myString",
            type: "string",
            kind: "bytes",
            trace: [
              {
                current: { hex: toHex(longString.length, { size: 1 }), decoded: BigInt(longString.length) },
                next: { hex: toHex(longerString.length, { size: 1 }), decoded: BigInt(longerString.length) },
                modified: true,
                slots: [getSlotHex(stringSlot)],
                path: [
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "myString._length",
              },
              {
                current: { hex: toHexFullBytes(longString), decoded: longString },
                next: { hex: toHexFullBytes(longerString), decoded: longerString },
                modified: true,
                slots: [
                  getSlotHex(stringSlot),
                  getDynamicSlotDataHex(stringSlot, 0), // Overwritten
                  getDynamicSlotDataHex(stringSlot, 1), // Overwritten
                  getDynamicSlotDataHex(stringSlot, 2), // Newly written
                ],
                path: [],
                fullExpression: "myString",
              },
            ],
          },
        }),
      );
    });
  });
});
