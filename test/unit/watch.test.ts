import { assert, describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants.js";
import { getClient, waitFor } from "@test/utils.js";
import { watchState } from "@/lib/watch/index.js";
import type { StateChange } from "@/lib/watch/types.js";

const { StoragePacking } = CONTRACTS;
const { caller, recipient } = ACCOUNTS;

/**
 * Contract watcher tests
 *
 * This test suite verifies:
 *
 * - Watching a contract for storage changes
 * - Watching an EOA for state changes
 */

describe("Watching a contract", () => {
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
      ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
      from: caller.toString(),
      addToBlockchain: true,
    });
    assert(txHash, "txHash is required");

    await waitFor(() => stateChanges.length > 0, { timeout: 5_000 });
    expect(stateChanges).toMatchSnapshot();

    unsubscribe();
  });

  it("should be able to watch an EOA for state changes", async () => {
    const client = getClient();
    const stateChanges: Array<StateChange> = [];

    const unsubscribe = await watchState({
      client,
      address: recipient.toString(),
      onStateChange: (state) => stateChanges.push(state),
    });

    // Run a transaction that modifies the contract state
    const { txHash } = await client.tevmCall({
      from: caller.toString(),
      to: recipient.toString(),
      value: 100n,
      addToBlockchain: true,
    });
    assert(txHash, "txHash is required");

    await waitFor(() => stateChanges.length > 0, { timeout: 5_000 });
    expect(stateChanges).toMatchSnapshot();

    unsubscribe();
  });
});
