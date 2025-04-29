import { parseEther } from "tevm/utils";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";
import { traceState } from "@/index";

const { NativeTransfer, ETHReceiver } = CONTRACTS;
const { caller, recipient } = ACCOUNTS;

/**
 * Native Transfers tests
 *
 * This test suite verifies:
 *
 * 1. Contract to contract native token transfers
 * 2. EOA to EOA native token transfers
 */
describe("Native Transfers", () => {
  it("should track native token transfers between contracts", async () => {
    const client = getClient();
    const transferAmount = parseEther("1");

    // Fund the sender contract
    await client.tevmDeal({
      account: NativeTransfer.address,
      amount: transferAmount,
    });

    // Transfer ETH from NativeTransfer to ETHReceiver
    expect(
      await traceState({
        ...NativeTransfer.write.transferEth(ETHReceiver.address, transferAmount),
        client,
        from: caller.toString(),
      }),
    ).toMatchSnapshot();
  });

  it("should track native token transfers between EOAs", async () => {
    const client = getClient();
    const transferAmount = parseEther("1");

    // Fund the sender
    await client.tevmDeal({
      account: caller.toString(),
      amount: transferAmount * 2n,
    });

    // Transfer ETH from caller to recipient
    expect(
      await traceState({
        client,
        from: caller.toString(),
        to: recipient.toString(),
        value: transferAmount,
      }),
    ).toMatchSnapshot();
  });
});
