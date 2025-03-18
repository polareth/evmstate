import { createMemoryClient, encodeFunctionData } from "tevm";
import { CONTRACTS } from "@test/constants";
import { beforeAll, describe, it } from "vitest";

import { getAccessList } from "@/index";

const client = createMemoryClient();
const MultiSlot = CONTRACTS.MultiSlot.withAddress(`0x${"1".repeat(40)}`);

describe("access-list", () => {
  beforeAll(async () => {
    await client.tevmSetAccount(MultiSlot);
  });

  it("should get access list from transaction data", async () => {
    const accessList = await getAccessList({
      client,
      from: "0x",
      to: MultiSlot.address,
      data: encodeFunctionData(MultiSlot.write.setMultipleValues(1n, 2n, 3n)),
    });

    console.log(JSON.stringify(accessList, null, 2));
  });

  it.todo("should get access list from past transaction");
});
