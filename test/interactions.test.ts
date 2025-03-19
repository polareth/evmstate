import { createMemoryClient } from "tevm";
import { CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

const client = createMemoryClient();
const ContractA = CONTRACTS.ContractA.withAddress(`0x${"ca".repeat(20)}`);
const ContractB = CONTRACTS.ContractB.withAddress(`0x${"cb".repeat(20)}`);
const ContractC = CONTRACTS.ContractC.withAddress(`0x${"cc".repeat(20)}`);

describe("interactions", () => {
  beforeAll(async () => {
    // Store the contracts in the accounts
    await client.tevmSetAccount(ContractA);
    await client.tevmSetAccount(ContractB);
    await client.tevmSetAccount(ContractC);

    // Set ContractB address in ContractA constructor
    // This would need implementation
  });

  it.todo("should trace direct single contract storage access");
  it.todo("should trace storage access across contract interactions (A -> B)");
  it.todo("should trace multi-level contract interactions (A -> B -> C)");
  it.todo("should handle calls to view functions correctly");
  it.todo("should capture storage reads and writes separately");
  it.todo("should maintain consistent behavior with complex interaction patterns");
});
