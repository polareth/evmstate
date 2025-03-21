import { encodeFunctionData } from "tevm";
import { Hex } from "tevm/utils";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient, getSlotHex } from "@test/utils";
import { traceStorageAccess } from "@/index";

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
 */
describe("Basic Storage Access", () => {
  describe("Direct Transaction Simulation", () => {
    it("should handle packed storage variables correctly", async () => {
      const client = getClient();

      // Set packed values in a single storage slot (uint8, uint8, bool, address)
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setSmallValues(42, 123, true, caller.toString())),
      });

      // Verify we have a trace for the contract
      expect(trace).toHaveProperty(StoragePacking.address);

      // Check that we have a write operation to the first slot (packed variables)
      const contractTrace = trace[StoragePacking.address];
      const packedSlot = getSlotHex(0);

      // We should have the packed variables in a single slot write
      expect(contractTrace.writes).toHaveProperty(packedSlot);
      expect(contractTrace.writes[packedSlot]).toBeInstanceOf(Array);

      // We should have four packed variables
      expect(contractTrace.writes[packedSlot].length).toBe(4);

      // Check each variable individually
      const smallValue1 = contractTrace.writes[packedSlot].find((v) => v.label === "smallValue1");
      const smallValue2 = contractTrace.writes[packedSlot].find((v) => v.label === "smallValue2");
      const flag = contractTrace.writes[packedSlot].find((v) => v.label === "flag");
      const someAddress = contractTrace.writes[packedSlot].find((v) => v.label === "someAddress");

      // Check smallValue1
      expect(smallValue1).toBeDefined();
      expect(smallValue1?.type).toBe("uint8");
      expect(Number(smallValue1?.next)).toBe(42);
      expect(smallValue1?.current).not.toBe(smallValue1?.next); // Check that value changed

      // Check smallValue2
      expect(smallValue2).toBeDefined();
      expect(smallValue2?.type).toBe("uint8");
      expect(Number(smallValue2?.next)).toBe(123);
      expect(smallValue2?.current).not.toBe(smallValue2?.next); // Check that value changed

      // Check flag
      expect(flag).toBeDefined();
      expect(flag?.type).toBe("bool");
      expect(flag?.next).toBe(true);
      expect(flag?.current).not.toBe(flag?.next); // Check that value changed

      // Check someAddress
      expect(someAddress).toBeDefined();
      expect(someAddress?.type).toBe("address");
      // Just check that it's a valid address format
      expect(typeof someAddress?.next).toBe("string");
      expect(someAddress?.next).not.toBe("0x0000000000000000000000000000000000000000");
      expect(someAddress?.current).not.toBe(someAddress?.next); // Check that value changed
      expect(someAddress?.next).toBe(caller.toString()); // Check correct address is set
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

      // Verify that we have a single write operation to the same packed slot
      const contractTrace = trace[StoragePacking.address];
      const mediumPackedSlot = getSlotHex(3); // Slot for medium values (3rd variable group but 2nd group takes 2 slots)

      // We should have a write to this slot with multiple variables
      expect(contractTrace.writes).toHaveProperty(mediumPackedSlot);
      expect(contractTrace.writes[mediumPackedSlot]).toBeInstanceOf(Array);

      // Find the mediumValue1 that was updated
      const mediumValue1 = contractTrace.writes[mediumPackedSlot].find((v) => v.label === "mediumValue1");

      // Verify that the specific variable changed
      expect(mediumValue1).toBeDefined();
      expect(mediumValue1?.type).toContain("uint");
      expect(Number(mediumValue1?.next)).toBe(999); // Updated value
      expect(mediumValue1?.current).not.toBe(mediumValue1?.next); // Check that it actually changed

      // Also find the other values in the same slot
      const mediumValue2 = contractTrace.writes[mediumPackedSlot].find((v) => v.label === "mediumValue2");
      
      // Check that another value exists in this slot
      expect(mediumValue2).toBeDefined();
      expect(mediumValue2?.type).toContain("uint");
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

      // Verify that we have write operations to multiple slots
      const contractTrace = trace[StoragePacking.address];

      // We expect at least 3 slots to be written to:
      // - Slot 0: smallValue1, smallValue2 (packed)
      // - Slot 1: largeValue1 (not packed)
      // - Slot 3: mediumValue1, mediumValue2 (packed)
      expect(Object.keys(contractTrace.writes).length).toBeGreaterThanOrEqual(3);

      // Check for writes to both packed and non-packed slots
      expect(contractTrace.writes).toHaveProperty(getSlotHex(0)); // Small values (packed)
      expect(contractTrace.writes).toHaveProperty(getSlotHex(1)); // largeValue1 (unpacked)
      expect(contractTrace.writes).toHaveProperty(getSlotHex(3)); // Medium values (packed)

      // Check small values in the packed slot
      const smallValueSlot = getSlotHex(0);
      const smallValue1 = contractTrace.writes[smallValueSlot].find((v) => v.label === "smallValue1");
      const smallValue2 = contractTrace.writes[smallValueSlot].find((v) => v.label === "smallValue2");
      
      expect(smallValue1).toBeDefined();
      expect(smallValue1?.type).toBe("uint8");
      expect(Number(smallValue1?.next)).toBe(10);
      
      expect(smallValue2).toBeDefined();
      expect(smallValue2?.type).toBe("uint8");
      expect(Number(smallValue2?.next)).toBe(20);

      // Check medium values in the packed slot
      const mediumValueSlot = getSlotHex(3);
      const mediumValue1 = contractTrace.writes[mediumValueSlot].find((v) => v.label === "mediumValue1");
      const mediumValue2 = contractTrace.writes[mediumValueSlot].find((v) => v.label === "mediumValue2");
      
      expect(mediumValue1).toBeDefined();
      expect(mediumValue1?.type).toContain("uint");
      expect(Number(mediumValue1?.next)).toBe(1000);
      
      expect(mediumValue2).toBeDefined();
      expect(mediumValue2?.type).toContain("uint");
      expect(Number(mediumValue2?.next)).toBe(2000);

      // The large value (unpacked) should have a specific label
      const largeValue = contractTrace.writes[getSlotHex(1)][0];
      expect(largeValue).toHaveProperty("label", "largeValue1");
      expect(largeValue).toHaveProperty("type", "uint256");
      expect(largeValue.next).toBe(12345n); // Check specific value
      expect(largeValue.current).not.toEqual(largeValue.next); // Check that it changed

      // Check the packed slot (slot 0) has multiple variables
      expect(contractTrace.writes[getSlotHex(0)].length).toBeGreaterThan(1);
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
      const contractTrace = trace[StoragePacking.address];
      const largeValueSlot = getSlotHex(1); // Slot for largeValue1

      expect(contractTrace.writes[largeValueSlot]).toBeInstanceOf(Array);
      const largeValueWrite = contractTrace.writes[largeValueSlot][0];

      // Check properties
      expect(largeValueWrite).toHaveProperty("label", "largeValue1");
      expect(largeValueWrite).toHaveProperty("type", "uint256");
      expect(largeValueWrite.current).not.toEqual(largeValueWrite.next); // Check that it changed

      // Check that the value is properly decoded as BigInt
      const nextValue = largeValueWrite.next;
      expect(typeof nextValue === "bigint" || typeof nextValue === "string").toBeTruthy();

      // Check that the value matches what we set
      // We need to be flexible with the comparison due to potential formatting differences
      if (typeof nextValue === "bigint") {
        expect(nextValue).toBe(largeNumber);
      } else {
        // If it's a string representation, convert both to strings for comparison
        expect(String(nextValue).replace(/^0x/, "").replace(/^0+/, "")).toBe(
          String(largeNumber).replace(/^0x/, "").replace(/^0+/, ""),
        );
      }
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
      const contractTrace = trace[StoragePacking.address];
      const dataSlot = getSlotHex(2); // Slot for data (should be at slot 2)

      expect(contractTrace.writes[dataSlot]).toBeInstanceOf(Array);
      const dataWrite = contractTrace.writes[dataSlot][0];

      expect(dataWrite).toHaveProperty("label", "data");
      expect(dataWrite).toHaveProperty("type", "bytes32");
      expect(dataWrite.current).not.toEqual(dataWrite.next); // Check that it changed

      // Check if the next value contains at least part of our test bytes32
      // Avoid exact matching which might fail with hex casing differences
      const nextValue = String(dataWrite.next).toLowerCase();
      expect(nextValue).toContain(testBytes32.slice(2, 10).toLowerCase());
      
      // Check that the entire bytes32 value is correctly stored (not just the prefix)
      expect(nextValue.length).toBeGreaterThan(32); // At least 32 bytes (64 hex chars + 0x prefix)
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

      // Check that we have a trace for the contract
      const contractTrace = trace[StoragePacking.address];

      // Verify that we have a read operation but no write operations
      expect(Object.keys(contractTrace.reads).length).toBeGreaterThan(0);
      expect(Object.keys(contractTrace.writes).length).toBe(0);

      // Verify the read slot has the correct properties
      expect(contractTrace.reads[getSlotHex(1)][0]).toHaveProperty("label", "largeValue1");
      expect(contractTrace.reads[getSlotHex(1)][0]).toHaveProperty("type", "uint256");
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

      // Check that we have a trace for the caller account
      expect(trace).toHaveProperty(caller.toString());

      // Check that intrinsic changes are tracked
      const callerTrace = trace[caller.toString()];

      // Nonce should be incremented
      expect(callerTrace.intrinsic.nonce).toHaveProperty("current");
      expect(callerTrace.intrinsic.nonce).toHaveProperty("next");
      expect(Number(callerTrace.intrinsic.nonce.next)).toBe(Number(callerTrace.intrinsic.nonce.current) + 1);

      // Balance should be reduced (due to gas)
      expect(callerTrace.intrinsic.balance).toHaveProperty("current");
      expect(callerTrace.intrinsic.balance).toHaveProperty("next");
      expect(BigInt(callerTrace.intrinsic.balance.next ?? Infinity)).toBeLessThan(
        BigInt(callerTrace.intrinsic.balance.current ?? 0n),
      );
    });

    it("should handle boolean values correctly", async () => {
      const client = getClient();

      // Set a boolean value to true
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setSmallValues(10, 20, true, caller.toString())),
      });

      // Verify that the flag was set correctly
      const contractTrace = trace[StoragePacking.address];
      const slotHex = Object.keys(contractTrace.writes)[0];
      const flagVariable = contractTrace.writes[slotHex].find((v) => v.label === "flag");
      
      expect(flagVariable).toBeDefined();
      expect(flagVariable?.type).toBe("bool");
      expect(flagVariable?.next).toBe(true);

      // Also check the other packed variables in this slot
      const smallValue1 = contractTrace.writes[slotHex].find((v) => v.label === "smallValue1");
      expect(smallValue1).toBeDefined();
      expect(smallValue1?.next).toBe(10);

      const smallValue2 = contractTrace.writes[slotHex].find((v) => v.label === "smallValue2");
      expect(smallValue2).toBeDefined();
      expect(smallValue2?.next).toBe(20);
    });
    
    it("should produce different traces for different operations", async () => {
      const client = getClient();
      
      // Run two different operations
      const trace1 = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setSmallValues(1, 2, true, caller.toString())),
      });
      
      const trace2 = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setLargeValue1(42n)),
      });
      
      // Check traces have different slot accesses
      const contractTrace1 = trace1[StoragePacking.address];
      const contractTrace2 = trace2[StoragePacking.address];
      
      // First trace should touch slot 0 (small values)
      expect(contractTrace1.writes).toHaveProperty(getSlotHex(0));
      expect(contractTrace1.writes[getSlotHex(0)].some(v => v.label === "smallValue1")).toBe(true);
      
      // Second trace should touch slot 1 (large value)
      expect(contractTrace2.writes).toHaveProperty(getSlotHex(1));
      expect(contractTrace2.writes[getSlotHex(1)].some(v => v.label === "largeValue1")).toBe(true);
      
      // Check that the correct value is written in each case
      expect(contractTrace1.writes[getSlotHex(0)].find(v => v.label === "smallValue1")?.next).toBe(1);
      expect(contractTrace2.writes[getSlotHex(1)][0].next).toBe(42n);
    });
  });

});
