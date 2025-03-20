// TODO: find better naming for test file

import { createMemoryClient, encodeFunctionData, http, parseEther } from "tevm";
import { describe, it } from "vitest";

import { ACCOUNTS, FORK } from "@test/constants";
import { traceStorageAccess } from "@/index";

const mainnet = FORK.mainnet;
const UniswapERC20 = mainnet.contracts.UniswapERC20;
const { caller, recipient } = ACCOUNTS;

const client = createMemoryClient({
  common: mainnet.common,
  fork: {
    transport: http(mainnet.rpcUrl),
    blockTag: "latest",
  },
});

describe("staging", () => {
  it("should get access list from transaction data", async () => {
    const amount = parseEther("10");

    await client.tevmDeal({
      erc20: UniswapERC20.address,
      account: caller.toString(),
      amount,
    });

    const accessList = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: UniswapERC20.address,
      data: encodeFunctionData(UniswapERC20.write.transfer(recipient.toString(), amount)),
      explorers: mainnet.explorers,
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
});
