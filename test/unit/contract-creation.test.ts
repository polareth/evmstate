import { describe, it } from "vitest";

import { CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";

const { Factory } = CONTRACTS;

describe("contract-creation", () => {
  it.todo("should include created contract addresses in the trace results");
  it.todo("should trace factory contract storage during contract creation");
  it.todo("should trace storage initialization in the created contract");
  it.todo("should capture account creation state changes");
  it.todo("should handle multiple contract creations in a single transaction");
});
