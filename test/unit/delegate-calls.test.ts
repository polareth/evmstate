import { describe, it } from "vitest";

import { CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";

const { DelegateBase, DelegateLogic } = CONTRACTS;

describe("delegate-calls", () => {
  it.todo("should trace storage access in the caller contract context during delegatecall");
  it.todo("should not access storage in the callee contract during delegatecall");
  it.todo("should trace correctly when multiple delegatecalls are performed");
  it.todo("should show different access patterns between normal calls and delegatecalls");
  it.todo("should trace state modifications in the caller's storage context");
});
