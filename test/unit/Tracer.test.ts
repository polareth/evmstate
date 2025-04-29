import { encodeFunctionData } from "tevm";
import { assert, describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";
import { Tracer, traceState } from "@/index";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Basic storage access tests with storage packing
 *
 * This test suite verifies:
 *
 * 1. Tracer class with transaction calldata
 * 2. Tracer class with abi
 * 3. Tracer class with transaction hash
 */

describe("Tracer class", () => {
  it("should work with transaction calldata", async () => {
    const client = getClient();
    const tracer = new Tracer({ client });

    expect(
      await tracer.traceState({
        from: caller.toString(),
        to: StoragePacking.address,
        data: encodeFunctionData(StoragePacking.write.setSmallValues(42, 123, true, caller.toString())),
      }),
    ).toMatchFileSnapshot("./__snapshots__/setSmallValues.shared.snap");
  });

  it("should work with abi", async () => {
    const client = getClient();
    const tracer = new Tracer({ client });

    expect(
      await tracer.traceState({
        ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
        from: caller.toString(),
      }),
    ).toMatchFileSnapshot("./__snapshots__/setSmallValues.shared.snap");
  });

  it("should work with transaction hash", async () => {
    const client = getClient();
    const tracer = new Tracer({ client });

    const { txHash } = await client.tevmContract({
      ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
      from: caller.toString(),
      addToBlockchain: true,
    });
    assert(txHash, "txHash is required");

    expect(
      await tracer.traceState({
        txHash,
      }),
    ).toMatchFileSnapshot("./__snapshots__/setSmallValues.shared.snap");
  });
});
