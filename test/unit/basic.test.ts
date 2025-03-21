import { encodeFunctionData } from "tevm";
import { Hex } from "tevm/utils";
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
            current: 0,
            next: 42,
            type: "uint8",
            offset: 0,
          },
          {
            label: "smallValue2",
            current: 0,
            next: 123,
            type: "uint8",
            offset: 1,
          },
          {
            label: "flag",
            current: false,
            next: true,
            type: "bool",
            offset: 2,
          },
          {
            label: "someAddress",
            current: "0x0000000000000000000000000000000000000000",
            next: caller.toString(),
            type: "address",
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
            current: 0,
            next: 999,
            type: "uint16",
            offset: 0,
          },
          {
            label: "mediumValue2",
            current: 0,
            next: 0,
            type: "uint32",
            offset: 2,
          },
          {
            label: "mediumValue3",
            current: 0n,
            next: 0n,
            type: "uint64",
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
            current: 0,
            next: 10,
            type: "uint8",
            offset: 0,
          },
          {
            label: "smallValue2",
            current: 0,
            next: 20,
            type: "uint8",
            offset: 1,
          },
          {
            label: "flag",
            current: false,
            next: false,
            type: "bool",
            offset: 2,
          },
          {
            label: "someAddress",
            current: "0x0000000000000000000000000000000000000000",
            next: "0x0000000000000000000000000000000000000000",
            type: "address",
            offset: 3,
          },
        ],
        [getSlotHex(3)]: [
          {
            label: "mediumValue1",
            current: 0,
            next: 1000,
            type: "uint16",
            offset: 0,
          },
          {
            label: "mediumValue2",
            current: 0,
            next: 2000,
            type: "uint32",
            offset: 2,
          },
          {
            label: "mediumValue3",
            current: 0n,
            next: 0n,
            type: "uint64",
            offset: 6,
          },
        ],
        [getSlotHex(1)]: [
          {
            label: "largeValue1",
            current: 0n,
            next: 12345n,
            type: "uint256",
            offset: 0,
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
            current: 0n,
            next: 123456789012345678901234567890n,
            type: "uint256",
            offset: 0,
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
            current: "0x0",
            next: testBytes32,
            type: "bytes32",
            offset: 0,
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
        [getSlotHex(1)]: [{ label: "largeValue1", current: 0n, type: "uint256", offset: 0 }],
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
            current: 0,
            next: 1,
            type: "uint8",
            offset: 0,
          },
          {
            label: "smallValue2",
            current: 0,
            next: 2,
            type: "uint8",
            offset: 1,
          },
          {
            label: "flag",
            current: false,
            next: true,
            type: "bool",
            offset: 2,
          },
          {
            label: "someAddress",
            current: "0x0000000000000000000000000000000000000000",
            next: caller.toString(),
            type: "address",
            offset: 3,
          },
        ],
      });
    });
  });
});
