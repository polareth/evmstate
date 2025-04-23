import { Hex, toHex } from "tevm";
import { assert, beforeEach, describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getClient, getSlotHex } from "@test/utils";
import { Tracer, traceStorageAccess } from "@/index";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Transaction replay tests
 *
 * This test suite verifies:
 *
 * - Transaction replay with traceStorageAccess
 * - Transaction replay with Tracer class
 */

// TODO: need eth_getProof to be implemented or debug_traceBlock
describe("Transaction replay", () => {
  const expectedTrace = expectedStorage(LAYOUTS.StoragePacking, {
    smallValue1: {
      name: "smallValue1",
      type: "uint8",
      kind: "primitive",
      trace: [
        {
          current: { hex: toHex(0, { size: 1 }), decoded: 0 },
          next: { hex: toHex(1, { size: 1 }), decoded: 1 },
          modified: true,
          slots: [getSlotHex(0)],
          path: [],
          fullExpression: "smallValue1",
        },
      ],
    },
    smallValue2: {
      name: "smallValue2",
      type: "uint8",
      kind: "primitive",
      trace: [
        {
          current: { hex: toHex(0, { size: 1 }), decoded: 0 },
          next: { hex: toHex(2, { size: 1 }), decoded: 2 },
          modified: true,
          slots: [getSlotHex(0)],
          path: [],
          fullExpression: "smallValue2",
        },
      ],
    },
    flag: {
      name: "flag",
      type: "bool",
      kind: "primitive",
      trace: [
        {
          current: { hex: toHex(0, { size: 1 }), decoded: false },
          next: { hex: toHex(1, { size: 1 }), decoded: true },
          modified: true,
          slots: [getSlotHex(0)],
          path: [],
          fullExpression: "flag",
        },
      ],
    },
    someAddress: {
      name: "someAddress",
      type: "address",
      kind: "primitive",
      trace: [
        {
          current: {
            hex: toHex(0, { size: 1 }),
            decoded: toHex(0, { size: 20 }),
          },
          next: { hex: caller.toString(), decoded: caller.toString() },
          modified: true,
          slots: [getSlotHex(0)],
          path: [],
          fullExpression: "someAddress",
        },
      ],
    },
  });

  let txHash: Hex | undefined;
  beforeEach(async () => {
    const client = getClient();
    const tx = await client.tevmContract({
      from: caller.toString(),
      to: StoragePacking.address,
      abi: StoragePacking.abi,
      functionName: "setSmallValues",
      args: [1, 2, true, caller.toString()],
      addToBlockchain: true,
    });

    txHash = tx.txHash;
  });

  it.todo("should be able to replay a transaction with traceStorageAccess", async () => {
    const client = getClient();
    assert(txHash, "txHash is required");

    const trace = await traceStorageAccess({ client, txHash });
    expect(trace[StoragePacking.address].storage).toEqual(expectedTrace);
  });

  it.todo("should be able to replay a transaction with Tracer class", async () => {
    const client = getClient();
    assert(txHash, "txHash is required");
    const tracer = new Tracer({ client });

    const trace = await tracer.traceStorageAccess({ txHash });
    expect(trace[StoragePacking.address].storage).toEqual(expectedTrace);
  });
});
