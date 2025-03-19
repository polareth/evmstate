import { createMemoryClient } from "tevm";
import { CALLER, CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

import { traceStorageAccess } from "@/index";

const client = createMemoryClient();
const Factory = CONTRACTS.Factory.withAddress(`0x${"fac".repeat(10)}`);

describe("contract-creation", () => {
  beforeAll(async () => {
    // Store the contracts in the accounts
    await client.tevmSetAccount(Factory);
  });

  it.todo("should include created contract addresses in the trace results");
  it.todo("should trace factory contract storage during contract creation");
  it.todo("should trace storage initialization in the created contract");
  it.todo("should capture account creation state changes");
  it.todo("should handle multiple contract creations in a single transaction");
});
