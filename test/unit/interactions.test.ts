import { beforeAll, describe, it } from "vitest";

import { CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";

const { ContractA, ContractB, ContractC } = CONTRACTS;

describe("interactions", () => {
  beforeAll(async () => {
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
