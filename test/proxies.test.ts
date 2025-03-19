import { createMemoryClient } from "tevm";
import { createAddress } from "tevm/address";
import { EthjsAccount } from "tevm/utils";
import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

import { traceStorageAccess } from "@/index";

const client = createMemoryClient();
const TransparentProxy = CONTRACTS.TransparentProxy.withAddress(`0x${"tp".repeat(20)}`);
const { admin } = ACCOUNTS;

describe("proxies", () => {
  beforeAll(async () => {
    // Store the contracts in the accounts
    await client.tevmSetAccount(TransparentProxy);

    // Initialize the admin account
    const vm = await client.transport.tevm.getVm();
    await vm.stateManager.putAccount(
      admin,
      EthjsAccount.fromAccountData({
        balance: 0n,
        nonce: 0n,
      }),
    );
  });

  it.todo("should trace proxy delegate calls to implementation");
  it.todo("should trace admin operations that change implementation");
  it.todo("should track proxy-specific storage slots separate from implementation slots");
  it.todo("should trace complex proxy patterns with multiple function calls");
  it.todo("should trace storage access during implementation upgrade");
});
