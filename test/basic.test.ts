import { createMemoryClient, encodeFunctionData } from "tevm";
import { CALLER, CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

import { traceStorageAccess } from "@/index";

const client = createMemoryClient();
const MultiSlot = CONTRACTS.MultiSlot.withAddress(`0x${"1".repeat(40)}`);
const StoragePacking = CONTRACTS.StoragePacking.withAddress(`0x${"4".repeat(40)}`);

describe("basic", () => {
  beforeAll(async () => {
    // Store the contracts in the account
    await client.tevmSetAccount(MultiSlot);
    await client.tevmSetAccount(StoragePacking);
  });

  it("should get access list from transaction data", async () => {
    const accessList = await traceStorageAccess({
      client,
      from: CALLER.toString(),
      to: MultiSlot.address,
      data: encodeFunctionData(MultiSlot.write.setMultipleValues(1n, 2n, 3n)),
    });

    // Use a custom replacer to handle BigInt values
    const replacer = (key: string, value: any) => {
      // Convert BigInt to string if encountered
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };

    console.log(JSON.stringify(accessList, replacer, 2));
  });

  it.todo("should get access list from past transaction");
  it.todo("should capture single slot updates");
  it.todo("should capture multiple slot updates in one transaction");
  it.todo("should track reads vs writes separately");
  it.todo("should handle packed storage variables correctly");
  it.todo("should detect account state changes (nonce, balance)");
});
