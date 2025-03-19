import { createMemoryClient } from "tevm";
import { EthjsAccount } from "tevm/utils";
import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

const client = createMemoryClient();
const SimpleERC20 = CONTRACTS.SimpleERC20.withAddress(`0x${"erc20".repeat(4)}`);
const { recipient } = ACCOUNTS;

describe("tokens", () => {
  beforeAll(async () => {
    // Store the contracts in the accounts
    await client.tevmSetAccount(SimpleERC20);

    // Initialize the recipient account
    const vm = await client.transport.tevm.getVm();
    await vm.stateManager.putAccount(
      recipient,
      EthjsAccount.fromAccountData({
        balance: 0n,
        nonce: 0n,
      }),
    );
  });

  it.todo("should trace token minting storage access");
  it.todo("should trace token transfer storage slot access");
  it.todo("should trace storage access during approval operations");
  it.todo("should trace transferFrom operations involving allowances");
  it.todo("should trace batch token operations affecting multiple balances");
});
