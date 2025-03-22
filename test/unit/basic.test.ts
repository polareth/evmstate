import { encodeFunctionData } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient, getSlotHex } from "@test/utils";
import { Tracer, traceStorageAccess } from "@/index";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Basic storage access tests
 *
 * This test suite verifies:
 *
 * 1. Basic storage access tracing for both packed and unpacked variables
 * 2. Detection of storage reads and writes with proper labeling and typing
 * 3. Handling of different data types (uint8/16/32/64/256, bool, bytes32, address)
 * 4. Correct tracking of packed storage variables in a single slot
 * 5. Individual updates to variables within packed slots
 * 6. Mixed operations across packed and unpacked slots
 * 7. Account state changes tracking (nonce, balance)
 * 8. Large numeric values handling
 * 9. Tracer class
 */
describe("Basic slots access and packing", () => {
  describe("Direct traceStorageAccess", () => {
    it("should handle packed storage variables correctly", async () => {
      const client = getClient();

      // Set packed values in a single storage slot (uint8, uint8, bool, address)
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setSmallValues(42, 123, true, caller.toString())),
      });

      // Check the read and write operations
      expect(trace[StoragePacking.address].reads).toEqual({});
      expect(trace[StoragePacking.address].writes).toEqual({
        [getSlotHex(0)]: [
          {
            label: "smallValue1",
            type: "uint8",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x2a", decoded: 42 },
          },
          {
            label: "smallValue2",
            type: "uint8",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x7b", decoded: 123 },
            offset: 1,
          },
          {
            label: "flag",
            type: "bool",
            current: { hex: "0x00", decoded: false },
            next: { hex: "0x01", decoded: true },
            offset: 2,
          },
          {
            label: "someAddress",
            type: "address",
            current: {
              hex: "0x00",
              decoded: "0x0000000000000000000000000000000000000000",
            },
            next: {
              hex: "0x0000000000000000000000000000000000000001",
              decoded: "0x0000000000000000000000000000000000000001",
            },
            offset: 3,
          },
        ],
      });
    });

    it("should handle individual updates to packed variables", async () => {
      const client = getClient();

      // Now update just one variable in the packed slot
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setMediumValue1(999)),
      });

      expect(trace[StoragePacking.address].reads).toEqual({});
      expect(trace[StoragePacking.address].writes).toEqual({
        // Slot for medium values (3rd variable group but 2nd group takes 2 slots)
        [getSlotHex(3)]: [
          {
            label: "mediumValue1",
            type: "uint16",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x03e7", decoded: 999 },
          },
          {
            label: "mediumValue2",
            type: "uint32",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x00000000", decoded: 0 }, // gets populated with 0 bytes when writing first variable
            offset: 2,
          },
          {
            label: "mediumValue3",
            type: "uint64",
            current: { hex: "0x00", decoded: 0n },
            next: { hex: "0x0000000000000000", decoded: 0n }, // same here
            offset: 6,
          },
        ],
      });
    });

    it("should track updates across multiple slots including packed and non-packed", async () => {
      const client = getClient();

      // Update values across multiple slots, including both packed and non-packed
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.updateAllValues(10, 20, 1000, 2000, 12345n)),
      });

      expect(trace[StoragePacking.address].reads).toEqual({});
      // We expect at least 3 slots to be written to:
      // - Slot 0: smallValue1, smallValue2, (packed) (flag & someAddress are not modified)
      // - Slot 3: mediumValue1, mediumValue2 (packed)
      // - Slot 1: largeValue1 (not packed) (written last)
      expect(trace[StoragePacking.address].writes).toEqual({
        [getSlotHex(0)]: [
          {
            label: "smallValue1",
            type: "uint8",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x0a", decoded: 10 },
          },
          {
            label: "smallValue2",
            type: "uint8",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x14", decoded: 20 },
            offset: 1,
          },
          {
            label: "flag",
            type: "bool",
            current: { hex: "0x00", decoded: false },
            next: { hex: "0x00", decoded: false },
            offset: 2,
          },
          {
            label: "someAddress",
            type: "address",
            current: {
              hex: "0x00",
              decoded: "0x0000000000000000000000000000000000000000",
            },
            next: {
              hex: "0x0000000000000000000000000000000000000000",
              decoded: "0x0000000000000000000000000000000000000000",
            },
            offset: 3,
          },
        ],
        [getSlotHex(3)]: [
          {
            label: "mediumValue1",
            type: "uint16",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x03e8", decoded: 1000 },
          },
          {
            label: "mediumValue2",
            type: "uint32",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x000007d0", decoded: 2000 },
            offset: 2,
          },
          {
            label: "mediumValue3",
            type: "uint64",
            current: { hex: "0x00", decoded: 0n },
            next: { hex: "0x0000000000000000", decoded: 0n },
            offset: 6,
          },
        ],
        [getSlotHex(1)]: [
          {
            label: "largeValue1",
            type: "uint256",
            current: { hex: "0x00", decoded: 0n },
            next: { hex: "0x0000000000000000000000000000000000000000000000000000000000003039", decoded: 12345n },
          },
        ],
      });
    });

    it("should handle large numeric values correctly", async () => {
      const client = getClient();

      const largeNumber = 123456789012345678901234567890n;

      // Set a large value in a non-packed slot
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setLargeValue1(largeNumber)),
      });

      // Verify that the large value was set correctly
      expect(trace[StoragePacking.address].reads).toEqual({});
      expect(trace[StoragePacking.address].writes).toEqual({
        [getSlotHex(1)]: [
          {
            label: "largeValue1",
            type: "uint256",
            current: { hex: "0x00", decoded: 0n },
            next: {
              hex: "0x00000000000000000000000000000000000000018ee90ff6c373e0ee4e3f0ad2",
              decoded: 123456789012345678901234567890n,
            },
          },
        ],
      });
    });

    it("should handle bytes32 data correctly", async () => {
      const client = getClient();

      const testBytes32 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      // Set the bytes32 data
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setData(testBytes32)),
      });

      // Verify that the data was set correctly
      expect(trace[StoragePacking.address].reads).toEqual({});
      expect(trace[StoragePacking.address].writes).toEqual({
        [getSlotHex(2)]: [
          {
            label: "data",
            type: "bytes32",
            current: { hex: "0x00", decoded: "0x0000000000000000000000000000000000000000000000000000000000000000" },
            next: { hex: testBytes32, decoded: testBytes32 },
          },
        ],
      });
    });

    it("should capture storage reads when getting values", async () => {
      const client = getClient();

      // Read the value and trace the storage access
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.read.getLargeValue1()),
      });

      // Verify that we have a read operation but no write operations
      expect(trace[StoragePacking.address].writes).toEqual({});
      expect(trace[StoragePacking.address].reads).toEqual({
        [getSlotHex(1)]: [{ label: "largeValue1", type: "uint256", current: { hex: "0x00", decoded: 0n } }],
      });
    });

    it("should detect account state changes (nonce, balance)", async () => {
      const client = getClient();

      // Perform a transaction that will modify caller's balance and nonce
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setLargeValue1(1n)),
      });

      const callerTrace = trace[caller.toString()];

      // No reads & writes as it's an EOA
      expect(callerTrace.reads).toEqual({});
      expect(callerTrace.writes).toEqual({});

      // Nonce should be incremented
      expect(Number(callerTrace.intrinsic.nonce.next)).toBe(Number(callerTrace.intrinsic.nonce.current) + 1);

      // Balance should be reduced (due to gas)
      expect(BigInt(callerTrace.intrinsic.balance.next ?? Infinity)).toBeLessThan(
        BigInt(callerTrace.intrinsic.balance.current ?? 0n),
      );
    });
  });

  describe("Tracer class", () => {
    it("should work similarily to traceStorageAccess", async () => {
      const client = getClient();
      const tracer = new Tracer({ client });

      const trace = await tracer.traceStorageAccess({
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setSmallValues(1, 2, true, caller.toString())),
      });

      expect(trace[StoragePacking.address].reads).toEqual({});
      expect(trace[StoragePacking.address].writes).toEqual({
        [getSlotHex(0)]: [
          {
            label: "smallValue1",
            type: "uint8",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x01", decoded: 1 },
          },
          {
            label: "smallValue2",
            type: "uint8",
            current: { hex: "0x00", decoded: 0 },
            next: { hex: "0x02", decoded: 2 },
            offset: 1,
          },
          {
            label: "flag",
            type: "bool",
            current: { hex: "0x00", decoded: false },
            next: { hex: "0x01", decoded: true },
            offset: 2,
          },
          {
            label: "someAddress",
            type: "address",
            current: {
              hex: "0x00",
              decoded: "0x0000000000000000000000000000000000000000",
            },
            next: {
              hex: "0x0000000000000000000000000000000000000001",
              decoded: "0x0000000000000000000000000000000000000001",
            },
            offset: 3,
          },
        ],
      });
    });
  });
});
