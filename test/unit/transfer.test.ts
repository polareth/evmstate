import { createAddress } from "tevm/address";
import { EthjsAccount, Hex, parseEther } from "tevm/utils";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";
import { traceStorageAccess } from "@/index";
import { IntrinsicsDiff } from "@/lib/trace/types";

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
    // Fund the sender contract
    const vm = await client.transport.tevm.getVm();
    await vm.stateManager.putAccount(
      createAddress(NativeTransfer.address),
      EthjsAccount.fromAccountData({
        balance: parseEther("10"),
        nonce: 0n,
      }),
    );
    const transferAmount = parseEther("1");

    // Get initial balances
    const initialSenderBalance = await client.getBalance({
      address: NativeTransfer.address,
    });
    const initialReceiverBalance = await client.getBalance({
      address: ETHReceiver.address,
    });

    // Transfer ETH from NativeTransfer to ETHReceiver
    const trace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: NativeTransfer.address,
      abi: NativeTransfer.abi,
      functionName: "transferEth",
      args: [ETHReceiver.address, transferAmount],
    });

    // There should be no storage changes
    expect(trace[NativeTransfer.address].storage).toEqual({});
    // Balance should be updated
    expect(trace[NativeTransfer.address].intrinsic).toEqual({
      balance: {
        current: initialSenderBalance,
        next: initialSenderBalance - transferAmount,
      },
      nonce: { current: 0n },
      codeHash: { current: expect.any(String) },
      deployedBytecode: { current: expect.any(String) },
      storageRoot: { current: expect.any(String) },
    } as const satisfies IntrinsicsDiff);

    // Same for the receiver
    expect(trace[ETHReceiver.address].storage).toEqual({});
    expect(trace[ETHReceiver.address].intrinsic).toEqual({
      balance: {
        current: initialReceiverBalance,
        next: initialReceiverBalance + transferAmount,
      },
      nonce: { current: 0n },
      codeHash: { current: expect.any(String) },
      deployedBytecode: { current: expect.any(String) },
      storageRoot: { current: expect.any(String) },
    } as const satisfies IntrinsicsDiff);
  });

  it("should track native token transfers between EOAs", async () => {
    const client = getClient();
    const transferAmount = parseEther("1");
    const senderAddress = caller.toString();
    const recipientAddress = recipient.toString();

    // Get initial balances
    const initialSenderBalance = await client.getBalance({
      address: senderAddress,
    });
    const initialReceiverBalance = await client.getBalance({
      address: recipientAddress,
    });

    // Simulate the call to get the gas cost
    const { amountSpent } = await client.tevmCall({
      from: senderAddress,
      to: recipientAddress,
      value: transferAmount,
    });

    // Transfer ETH from caller to recipient
    const trace = await traceStorageAccess({
      client,
      from: senderAddress,
      to: recipientAddress,
      value: transferAmount,
    });

    // There should be no storage changes (it's an EOA)
    expect(trace[senderAddress].storage).toEqual({});
    // Balance should be updated
    expect(trace[senderAddress].intrinsic).toEqual({
      balance: {
        current: initialSenderBalance,
        next: initialSenderBalance - transferAmount - (amountSpent ?? 0n),
      },
      nonce: { current: 0n, next: 1n },
      codeHash: { current: expect.any(String) },
      deployedBytecode: { current: expect.any(String) },
      storageRoot: { current: expect.any(String) },
    } as const satisfies IntrinsicsDiff);

    // Same for the recipient
    expect(trace[recipientAddress].storage).toEqual({});
    expect(trace[recipientAddress].intrinsic).toEqual({
      balance: {
        current: initialReceiverBalance,
        next: initialReceiverBalance + transferAmount,
      },
      nonce: { current: 0n },
      codeHash: { current: expect.any(String) },
      deployedBytecode: { current: expect.any(String) },
      storageRoot: { current: expect.any(String) },
    } as const satisfies IntrinsicsDiff);
  });
});
