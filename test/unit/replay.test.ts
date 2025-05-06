import { assert, describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants.js";
import { getClient } from "@test/utils.js";
import { traceState } from "@/index.js";

const { StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Transaction replay tests
 *
 * This test suite verifies:
 *
 * - Transaction replay with traceState
 */
describe("Transaction replay", () => {
  it("should be able to replay a transaction with a tx hash", async () => {
    const client = getClient();

    const { txHash } = await client.tevmContract({
      ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
      from: caller.toString(),
      addToBlockchain: true,
    });
    assert(txHash, "txHash is required");

    expect(
      await traceState({
        client,
        txHash,
      }),
    ).toMatchFileSnapshot("./__snapshots__/setSmallValues.shared.snap");
  });
});
