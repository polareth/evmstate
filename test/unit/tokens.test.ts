import { describe, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";

const { SimpleERC20 } = CONTRACTS;
const { recipient } = ACCOUNTS;

describe("tokens", () => {
  it.todo("should trace token minting storage access");
  it.todo("should trace token transfer storage slot access");
  it.todo("should trace storage access during approval operations");
  it.todo("should trace transferFrom operations involving allowances");
  it.todo("should trace batch token operations affecting multiple balances");
});
