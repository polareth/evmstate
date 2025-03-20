import { describe, it } from "vitest";

import { CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";

const { Arrays, Mappings } = CONTRACTS;

describe("data-structures", () => {
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
