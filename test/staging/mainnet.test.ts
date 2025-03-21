import { createMemoryClient, encodeFunctionData, http, parseEther } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, FORK } from "@test/constants";
import { getSlotHex } from "@test/utils";
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

// There is probably a better way (grab latest transactions, also free rpc will have a limit of how far back it can go)
const txHash = "0x67605b4fcf6dfa23654b5d2b5931c6dc540335c83f6905152fb46007c6350cc5";

describe("Mainnet ERC20", () => {
  describe("Transaction simulation", () => {
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
    });
  });

  describe("Transaction replay", { sequential: true }, () => {
    // TODO: port old test to this ERC20 (just use tx hash)
    it.todo("should trace storage access from a transaction hash", async () => {
      // First perform a transaction to get a hash
      const result = await client.tevmContract({
        ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
        from: caller.toString(),
        createTransaction: true,
      });

      // Wait for the transaction to be mined
      assert(result.txHash, "Transaction needs to return a txHash");
      await client.tevmMine();
      const receipt = await client.waitForTransactionReceipt({ hash: result.txHash });

      // Now trace using the transaction hash
      const trace = await traceStorageAccess({
        client,
        txHash: receipt.transactionHash,
      });

      // Verify that we have a trace for the contract
      expect(trace).toHaveProperty(StoragePacking.address);

      // Check the packed variables in slot 0
      const contractTrace = trace[StoragePacking.address];
      console.log(contractTrace);
      const packedSlot = getSlotHex(0);

      // We should have the packed variables in a single slot
      expect(contractTrace.writes).toHaveProperty(packedSlot);
      expect(contractTrace.writes[packedSlot]).toBeInstanceOf(Array);

      // We should have four packed variables
      expect(contractTrace.writes[packedSlot].length).toBe(4);

      // Check that we found smallValue1 with the right value
      const smallValue1 = contractTrace.writes[packedSlot].find((v) => v.label === "smallValue1");
      expect(smallValue1).toBeDefined();
      expect(smallValue1?.type).toBe("uint8");
      expect(Number(smallValue1?.next)).toBe(42);
    });
  });
});
