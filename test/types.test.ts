import { assert, describe, expect, expectTypeOf, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants.js";
import { getClient, waitFor } from "@test/utils.js";
import { Tracer, traceState, TraceStateResult, watchState, type LabeledState, type StateChange } from "@/index.js";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Type tests
 *
 * This test suite verifies:
 *
 * 1. `traceState` return type
 * 2. `watchState` return type
 * 3. `Tracer.traceState` return type
 * 4. `useTracer` return type
 */

describe("Types", () => {
  it("traceState", async () => {
    const client = getClient();
    const state = await traceState({
      ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
      client,
      from: caller.toString(),
    });
    expect(state).toBeInstanceOf(TraceStateResult);
    expectTypeOf(state.get(StoragePacking.address)).toEqualTypeOf<LabeledState | undefined>();
  });

  it("watchState", async () => {
    const client = getClient();
    const stateChanges: Array<StateChange<typeof LAYOUTS.StoragePacking>> = [];

    const unsubscribe = await watchState({
      client,
      address: StoragePacking.address,
      abi: StoragePacking.abi,
      storageLayout: LAYOUTS.StoragePacking,
      onStateChange: (state) => {
        stateChanges.push(state);
        expectTypeOf(state).toEqualTypeOf<StateChange<typeof LAYOUTS.StoragePacking>>();
      },
    });

    // Run a transaction that modifies the contract state
    const { txHash } = await client.tevmContract({
      ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
      from: caller.toString(),
      addToBlockchain: true,
    });
    assert(txHash, "txHash is required");

    await waitFor(() => stateChanges.length > 0, { timeout: 5_000 });
    expect(stateChanges.length).toBeGreaterThan(0);

    unsubscribe();
  });

  it("Tracer.traceState", async () => {
    const client = getClient();
    const tracer = new Tracer({ client });
    const state = await tracer.traceState({
      ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
    });
    expect(state).toBeInstanceOf(TraceStateResult);
    expectTypeOf(state.get(StoragePacking.address)).toEqualTypeOf<LabeledState | undefined>();
  });
});
