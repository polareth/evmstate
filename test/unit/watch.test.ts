import { parseEther, toHex } from "tevm";
import { assert, describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getClient, getSlotHex, waitFor } from "@test/utils";
import { IntrinsicsDiff } from "@/index";
import { EMPTY_CODE_HASH, EMPTY_STORAGE_ROOT } from "@/lib/trace/access-list";
import { watchState } from "@/lib/watch";
import { StateChange } from "@/lib/watch/types";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Contract watcher tests
 *
 * This test suite verifies:
 *
 * - Watching a contract for storage changes
 * - Watching an EOA for state changes
 */

describe("Watching a contract", () => {
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

  it("should be able to watch a contract for state changes", async () => {
    const client = getClient();
    const stateChanges: Array<StateChange<typeof LAYOUTS.StoragePacking>> = [];

    const unsubscribe = await watchState({
      client,
      address: StoragePacking.address,
      abi: StoragePacking.abi,
      storageLayout: LAYOUTS.StoragePacking,
      onStateChange: (state) => stateChanges.push(state),
    });

    // Run a transaction that modifies the contract state
    const { txHash } = await client.tevmContract({
      from: caller.toString(),
      to: StoragePacking.address,
      abi: StoragePacking.abi,
      functionName: "setSmallValues",
      args: [1, 2, true, caller.toString()],
      addToBlockchain: true,
    });
    assert(txHash, "txHash is required");

    await waitFor(() => stateChanges.length > 0, { timeout: 5_000 });
    expect(stateChanges.length).toEqual(1);
    expect(stateChanges[0].storage).toMatchObject(expectedTrace);
    expect(stateChanges[0].txHash).toEqual(txHash);

    unsubscribe();
  });

  it("should be able to watch an EOA for state changes", async () => {
    const client = getClient();
    const stateChanges: Array<StateChange> = [];

    const unsubscribe = await watchState({
      client,
      address: caller.toString(),
      onStateChange: (state) => stateChanges.push(state),
    });

    // Run a transaction that modifies the contract state
    const { txHash, amountSpent } = await client.tevmContract({
      from: caller.toString(),
      to: StoragePacking.address,
      abi: StoragePacking.abi,
      functionName: "setSmallValues",
      args: [1, 2, true, caller.toString()],
      addToBlockchain: true,
    });
    assert(txHash, "txHash is required");

    await waitFor(() => stateChanges.length > 0, { timeout: 5_000 });
    expect(stateChanges.length).toEqual(1);
    expect(stateChanges[0]).toMatchObject({
      storage: {},
      intrinsic: {
        balance: { current: parseEther("10"), next: parseEther("10") - (amountSpent ?? 0n) },
        nonce: { current: 0n, next: 1n },
        deployedBytecode: { current: "0x" },
        codeHash: { current: EMPTY_CODE_HASH },
        storageRoot: { current: EMPTY_STORAGE_ROOT },
        isContract: { current: false },
      } satisfies IntrinsicsDiff,
      txHash,
    });

    unsubscribe();
  });
});
