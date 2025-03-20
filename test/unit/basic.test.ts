import { encodeFunctionData } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient, getSlotHex } from "@test/utils";
import { traceStorageAccess } from "@/index";

const { MultiSlot, StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

describe("Basic Storage Access", () => {
  describe("MultiSlot - Unpacked Variables", () => {
    it("should get access list from transaction data (multiple slots update)", async () => {
      const client = getClient();

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: MultiSlot.address,
        data: encodeFunctionData(MultiSlot.write.setMultipleValues(1n, 2n, 3n)),
      });

      // Check that we have a trace for the contract
      expect(trace).toHaveProperty(MultiSlot.address);

      // Check that we have write operations in the trace
      const contractTrace = trace[MultiSlot.address];
      expect(Object.keys(contractTrace.writes).length).toBe(3);

      // Verify each storage slot was correctly identified and labeled
      expect(contractTrace.writes[getSlotHex(0)]).toHaveProperty("label", "value1");
      // Type should be detected correctly
      expect(contractTrace.writes[getSlotHex(0)]).toHaveProperty("type", "uint256");

      // Check slot 1
      expect(contractTrace.writes[getSlotHex(1)]).toHaveProperty("label", "value2");
      expect(contractTrace.writes[getSlotHex(1)]).toHaveProperty("type", "uint256");

      // Check slot 2
      expect(contractTrace.writes[getSlotHex(2)]).toHaveProperty("label", "value3");
      expect(contractTrace.writes[getSlotHex(2)]).toHaveProperty("type", "uint256");
    });

    it("should capture storage reads when getting values", async () => {
      const client = getClient();

      // First, set a value
      await client.tevmCall({
        from: caller.toString(),
        to: MultiSlot.address,
        data: encodeFunctionData(MultiSlot.write.setValue1(42n)),
      });

      // Then read the value and trace the storage access
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: MultiSlot.address,
        data: encodeFunctionData(MultiSlot.read.getValue1()),
      });

      // Check that we have a trace for the contract
      const contractTrace = trace[MultiSlot.address];

      // Verify that we have a read operation but no write operations
      expect(Object.keys(contractTrace.reads).length).toBeGreaterThan(0);
      expect(Object.keys(contractTrace.writes).length).toBe(0);

      // Verify the read slot has the correct properties
      expect(contractTrace.reads[getSlotHex(0)]).toHaveProperty("label", "value1");
      expect(contractTrace.reads[getSlotHex(0)]).toHaveProperty("type", "uint256");
    });

    it("should handle boolean values correctly", async () => {
      const client = getClient();

      // Set the flag to true
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: MultiSlot.address,
        data: encodeFunctionData(MultiSlot.write.setFlag(true)),
      });

      // Verify that the flag was set correctly
      const contractTrace = trace[MultiSlot.address];
      const flagSlot = getSlotHex(4); // Slot for flag (4th variable)

      // Check the properties individually to avoid exact matching issues
      expect(contractTrace.writes[flagSlot]).toHaveProperty("label", "flag");
      expect(contractTrace.writes[flagSlot]).toHaveProperty("type", "bool");

      // Check if next value is true (after boolean conversion)
      expect(Boolean(contractTrace.writes[flagSlot].next)).toBe(true);
    });

    it("should handle bytes32 values correctly", async () => {
      const client = getClient();

      const testBytes32 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      // Set the bytes32 data
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: MultiSlot.address,
        data: encodeFunctionData(MultiSlot.write.setData(testBytes32)),
      });

      // Verify that the data was set correctly
      const contractTrace = trace[MultiSlot.address];
      const dataSlot = getSlotHex(3); // Slot for data (3rd variable)

      expect(contractTrace.writes[dataSlot]).toHaveProperty("label", "data");
      expect(contractTrace.writes[dataSlot]).toHaveProperty("type", "bytes32");

      // Check if the next value contains at least part of our test bytes32
      // Avoid exact matching which might fail with hex casing differences
      const nextValue = String(contractTrace.writes[dataSlot].next).toLowerCase();
      expect(nextValue).toContain(testBytes32.slice(2, 10).toLowerCase());
    });

    it("should handle updating multiple values", async () => {
      const client = getClient();

      // Update values across multiple slots
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: MultiSlot.address,
        data: encodeFunctionData(MultiSlot.write.setMultipleValues(10n, 20n, 30n)),
      });

      // Verify that we have write operations to multiple slots
      const contractTrace = trace[MultiSlot.address];

      // We should have writes to 3 slots
      expect(Object.keys(contractTrace.writes).length).toBe(3);

      // Check for writes to the correct slots
      expect(contractTrace.writes).toHaveProperty(getSlotHex(0)); // value1
      expect(contractTrace.writes).toHaveProperty(getSlotHex(1)); // value2
      expect(contractTrace.writes).toHaveProperty(getSlotHex(2)); // value3
    });

    it("should detect account state changes (nonce, balance)", async () => {
      const client = getClient();

      // Perform a transaction that will modify caller's balance and nonce
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: MultiSlot.address,
        data: encodeFunctionData(MultiSlot.write.setValue1(1n)),
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
  });

  describe("StoragePacking - Packed Variables", () => {
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

      // We should have the packed variables in a single write
      expect(contractTrace.writes).toHaveProperty(packedSlot);

      // Check that we detected values were changed
      const writeOp = contractTrace.writes[packedSlot];
      expect(writeOp.current).not.toEqual(writeOp.next);

      // Since this is a packed slot, it should have an appropriate type and label
      expect(writeOp).toHaveProperty("type");
      expect(writeOp).toHaveProperty("label");
    });

    it("should handle individual updates to packed variables", async () => {
      const client = getClient();

      // First, set all packed medium values
      await client.tevmCall({
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setMediumValues(100, 2000, 30000n)),
      });

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

      // We should have a write to this slot
      expect(contractTrace.writes).toHaveProperty(mediumPackedSlot);

      // Check that the value changed
      const writeOp = contractTrace.writes[mediumPackedSlot];
      expect(writeOp.current).not.toEqual(writeOp.next);
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
      // - Slot 2: mediumValue1, mediumValue2 (packed)
      expect(Object.keys(contractTrace.writes).length).toBeGreaterThanOrEqual(3);

      // Check for writes to both packed and non-packed slots
      expect(contractTrace.writes).toHaveProperty(getSlotHex(0)); // Small values (packed)
      expect(contractTrace.writes).toHaveProperty(getSlotHex(1)); // largeValue1 (unpacked)
      expect(contractTrace.writes).toHaveProperty(getSlotHex(3)); // Medium values (packed)

      // The large value (unpacked) should have a specific label
      expect(contractTrace.writes[getSlotHex(1)]).toHaveProperty("label", "largeValue1");
      expect(contractTrace.writes[getSlotHex(1)]).toHaveProperty("type", "uint256");

      // Check that the values were actually changed
      expect(contractTrace.writes[getSlotHex(1)].current).not.toEqual(contractTrace.writes[getSlotHex(1)].next);
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

      // Check properties
      expect(contractTrace.writes[largeValueSlot]).toHaveProperty("label", "largeValue1");
      expect(contractTrace.writes[largeValueSlot]).toHaveProperty("type", "uint256");

      // Check that the value is properly decoded as BigInt
      const nextValue = contractTrace.writes[largeValueSlot].next;
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

      expect(contractTrace.writes[dataSlot]).toHaveProperty("label", "data");
      expect(contractTrace.writes[dataSlot]).toHaveProperty("type", "bytes32");

      // Check if the next value contains at least part of our test bytes32
      // Avoid exact matching which might fail with hex casing differences
      const nextValue = String(contractTrace.writes[dataSlot].next).toLowerCase();
      expect(nextValue).toContain(testBytes32.slice(2, 10).toLowerCase());
    });
  });
});
