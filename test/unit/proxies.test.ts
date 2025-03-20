import { describe, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";

const { TransparentProxy } = CONTRACTS;
const { admin } = ACCOUNTS;

describe("proxies", () => {
  it.todo("should trace proxy delegate calls to implementation");
  it.todo("should trace admin operations that change implementation");
  it.todo("should track proxy-specific storage slots separate from implementation slots");
  it.todo("should trace complex proxy patterns with multiple function calls");
  it.todo("should trace storage access during implementation upgrade");
});
