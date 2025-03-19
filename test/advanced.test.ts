import { createMemoryClient } from "tevm";
import { CALLER, CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

import { traceStorageAccess } from "@/index";

const client = createMemoryClient();
const AssemblyStorage = CONTRACTS.AssemblyStorage.withAddress(`0x${"a".repeat(40)}`);

describe("advanced", () => {
  beforeAll(async () => {
    // Store the contract in the account
    await client.tevmSetAccount(AssemblyStorage);
  });

  it.todo("should trace storage access from assembly sload operations");
  it.todo("should trace storage access from assembly sstore operations");
  it.todo("should capture complex assembly storage access in mappings");
  it.todo("should track batch assembly operations across multiple slots");
  it.todo("should compare standard Solidity vs assembly storage access patterns");
});
