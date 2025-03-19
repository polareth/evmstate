import { createMemoryClient } from "tevm";
import { CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

const client = createMemoryClient();
const Arrays = CONTRACTS.Arrays.withAddress(`0x${"d1".repeat(20)}`);
const Mappings = CONTRACTS.Mappings.withAddress(`0x${"d2".repeat(20)}`);

describe("data-structures", () => {
  beforeAll(async () => {
    // Store the contracts in the accounts
    await client.tevmSetAccount(Arrays);
    await client.tevmSetAccount(Mappings);
  });

  describe("arrays", () => {
    it.todo("should trace fixed array slot access");
    it.todo("should trace dynamic array length slot access when pushing elements");
    it.todo("should trace dynamic array element slot access");
    it.todo("should trace struct array slot access with complex data");
    it.todo("should trace nested array slot access patterns");
  });

  describe("mappings", () => {
    it.todo("should trace simple mapping slot access");
    it.todo("should trace nested mapping slot access");
    it.todo("should trace mapping with struct values slot access");
    it.todo("should trace complex mapping operations with multiple keys");
  });
});
