import { createMemoryClient } from "tevm";
import { CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

const client = createMemoryClient();
const LibraryUser = CONTRACTS.LibraryUser.withAddress(`0x${"lu".repeat(20)}`);
const ExternalLibrary = CONTRACTS.ExternalLibrary.withAddress(`0x${"el".repeat(20)}`);

describe("libraries", () => {
  beforeAll(async () => {
    // Store the contracts in the accounts
    await client.tevmSetAccount(LibraryUser);
    await client.tevmSetAccount(ExternalLibrary);
  });

  it.todo("should trace internal library function storage access");
  it.todo("should trace external library function storage access");
  it.todo("should differentiate between storage context in external library calls vs delegatecalls");
  it.todo("should trace complex operations involving both internal and external libraries");
  it.todo("should correctly handle library storage access when libraries modify state");
});
