import { createMemoryClient } from "tevm";
import { CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

const client = createMemoryClient();
const DelegateBase = CONTRACTS.DelegateBase.withAddress(`0x${"dc1".repeat(10)}`);
const DelegateLogic = CONTRACTS.DelegateLogic.withAddress(`0x${"dc2".repeat(10)}`);

describe("delegate-calls", () => {
  beforeAll(async () => {
    // Store the contracts in the accounts
    await client.tevmSetAccount(DelegateBase);
    await client.tevmSetAccount(DelegateLogic);
  });

  it.todo("should trace storage access in the caller contract context during delegatecall");
  it.todo("should not access storage in the callee contract during delegatecall");
  it.todo("should trace correctly when multiple delegatecalls are performed");
  it.todo("should show different access patterns between normal calls and delegatecalls");
  it.todo("should trace state modifications in the caller's storage context");
});
