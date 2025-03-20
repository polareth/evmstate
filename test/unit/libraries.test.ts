import { describe, it } from "vitest";

import { CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";

const { /* LibraryUser, */ ExternalLibrary } = CONTRACTS;

describe("libraries", () => {
  it.todo("should trace internal library function storage access");
  it.todo("should trace external library function storage access");
  it.todo("should differentiate between storage context in external library calls vs delegatecalls");
  it.todo("should trace complex operations involving both internal and external libraries");
  it.todo("should correctly handle library storage access when libraries modify state");
});
