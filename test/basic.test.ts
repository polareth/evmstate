import { Address, createMemoryClient, encodeFunctionData } from "tevm";
import { createAddress } from "tevm/address";
import { EthjsAccount } from "tevm/utils";
import { CONTRACTS } from "@test/constants";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { beforeAll, describe, it } from "vitest";

import { traceStorageAccess } from "@/index";

const client = createMemoryClient();
const MultiSlot = CONTRACTS.MultiSlot.withAddress(`0x${"1".repeat(40)}`);
const caller = createAddress(`0x${"2".repeat(40)}`);

describe("basic", () => {
  beforeAll(async () => {
    // Store the contract in the account
    await client.tevmSetAccount(MultiSlot);

    // Initialize the caller account
    const vm = await client.transport.tevm.getVm();
    await vm.stateManager.putAccount(
      caller,
      EthjsAccount.fromAccountData({
        balance: 0n,
        nonce: 0n,
      }),
    );
  });

  it("should get access list from transaction data", async () => {
    const accessList = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: MultiSlot.address,
      data: encodeFunctionData(MultiSlot.write.setMultipleValues(1n, 2n, 3n)),
    });

    // Use a custom replacer to handle BigInt values
    const replacer = (key: string, value: any) => {
      // Convert BigInt to string if encountered
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    };
    
    console.log(JSON.stringify(accessList, replacer, 2));
  });

  it.todo("should get access list from past transaction");
});
