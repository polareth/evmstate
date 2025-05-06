import { getAddress } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants.js";
import { getClient } from "@test/utils.js";
import { traceState } from "@/index.js";

const { Mappings } = CONTRACTS;
const { caller, recipient } = ACCOUNTS;

/**
 * Mappings tests
 *
 * This test suite verifies:
 *
 * 1. Simple and nested mapping slot access
 * 2. Mapping with struct values
 * 3. Complex mapping operations with storage updates
 * 4. Fixed and dynamic array storage access patterns
 * 5. Array length slot access and element storage
 * 6. Struct arrays with complex data storage layout
 * 7. Nested array storage patterns
 */
describe("Mappings", () => {
  it("should trace simple mapping slot access", async () => {
    const client = getClient();

    // Set a value in the balances mapping
    expect(
      await traceState({
        ...Mappings.write.setBalance(recipient.toString(), 1000n),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();

    // Run the actual tx
    await client.tevmContract({
      ...Mappings.write.setBalance(recipient.toString(), 1000n),
      from: caller.toString(),
      addToBlockchain: true,
    });

    // Read the value and check if the same slot is accessed
    expect(
      await traceState({
        ...Mappings.read.getBalance(recipient.toString()),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();
  });

  it("should trace nested mapping slot access", async () => {
    const client = getClient();

    // Set an allowance (nested mapping)
    expect(
      await traceState({
        ...Mappings.write.setAllowance(caller.toString(), recipient.toString(), 1000n),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();
  });

  it("... even with a ridiculously nested mapping", async () => {
    const client = getClient();
    const [a, b, c, d] = Array.from({ length: 4 }, (_, i) =>
      getAddress(`0xad${i.toString().repeat(38)}`.toLowerCase()),
    );

    expect(
      await traceState({
        ...Mappings.write.setRidiculouslyNestedMapping(a, b, c, d, 1000n),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();
  });

  it("should trace mapping with struct values slot access", async () => {
    const client = getClient();

    // Set a struct in the userInfo mapping
    expect(
      await traceState({
        ...Mappings.write.setUserInfo(recipient.toString(), 1000n, 12345n, true),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();
  });

  it("should trace complex mapping operations with multiple keys", async () => {
    const client = getClient();

    // First set up the initial struct
    await client.tevmContract({
      ...Mappings.write.setUserInfo(recipient.toString(), 100n, 100n, true),
      from: caller.toString(),
      addToBlockchain: true,
    });

    // Now update just the balance field
    expect(
      await traceState({
        ...Mappings.write.updateUserBalance(recipient.toString(), 300n),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();
  });

  it("should trace mapping to an array", async () => {
    const client = getClient();

    expect(
      await traceState({
        ...Mappings.write.setArrayMapping(1n, 100n),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();
  });
});
