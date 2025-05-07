import { assert, describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants.js";
import { getClient } from "@test/utils.js";
import { traceState } from "@/index.js";

const { Factory, SimpleContract } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Contract creation tests
 *
 * This test suite verifies:
 *
 * 1. Tracing contract creation from a factory contract
 * 2. Capturing state changes in the factory contract (array updates)
 * 3. Capturing state changes in the created contracts (initialization)
 * 4. Tracing interactions with created contracts
 */
describe("Contract creation", () => {
  it("should trace contract creation and factory state changes", async () => {
    const client = getClient();

    // Deploy a contract from the factory
    expect(
      await traceState({
        ...Factory.write.createContract(123n),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();
  });

  it("should trace interactions with a created contract", async () => {
    const client = getClient();

    // First create a contract
    const { data: contractAddress } = await client.tevmContract({
      ...Factory.write.createContract(123n),
      from: caller.toString(),
      addToBlockchain: true,
    });
    assert(contractAddress, "Contract address should be defined");

    // Trace a setter function call with the created contract
    expect(
      await traceState({
        ...SimpleContract.write.setValue(456n),
        client,
        from: caller.toString(),
        to: contractAddress,
      }),
    ).toMatchSnapshot();

    // Trace a getter function call with the created contract
    expect(
      await traceState({
        client,
        from: caller.toString(),
        to: contractAddress,
        abi: SimpleContract.abi,
        functionName: "getValue",
        args: [],
      }),
    ).toMatchSnapshot();
  });
});
