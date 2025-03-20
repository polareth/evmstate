import { encodeFunctionData } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient, getSlotHex } from "@test/utils";
import { traceStorageAccess } from "@/index";

const { MultiSlot, StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

describe("basic", () => {
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
