import { createContract } from "tevm/contract";

import { traceState, type LabeledState } from "@polareth/evmstate";

import { erc20Abi, simpleDexAbi } from "./abi.js";
import { client } from "./client.js";
import { erc20Layout } from "./layout.js";

// [!region args]
// Create contract helpers
const SimpleDex = createContract({ abi: simpleDexAbi, name: "SimpleDex" });
const ERC20 = createContract({ abi: erc20Abi, name: "ERC20" });

const simpleDex = SimpleDex.withAddress("0x111...");
const inputToken = ERC20.withAddress("0x222...");
const outputToken = ERC20.withAddress("0x333...");
const caller = "0x444...";
const amount = 100n;
// [!endregion args]

// [!region approve]
// Approve spending
const { errors } = await client.tevmContract({
  ...inputToken.write.approve(simpleDex.address, amount),
  from: caller,
  addToBlockchain: true,
});
if (errors) throw new Error(`Failed to approve: ${JSON.stringify(errors.map((e) => e.message))}`);
// [!endregion approve]

// [!region trace-swap]
// Trace the swap with evmstate
const state = await traceState({
  ...simpleDex.write.swap(inputToken.address, outputToken.address, amount, 0n),
  client,
  from: caller,
  // we can directly provide the storage layouts instead of fetching them
  storageLayouts: {
    [inputToken.address]: erc20Layout,
    [outputToken.address]: erc20Layout,
  },
  fetchStorageLayouts: false,
});
// [!endregion trace-swap]

// [!region trace-parse]
// Get the labeled storage for the input and output tokens
const inputTokenStorage = (state.get(inputToken.address) as LabeledState<typeof erc20Layout> | undefined)?.storage;
const outputTokenStorage = (state.get(outputToken.address) as LabeledState<typeof erc20Layout> | undefined)?.storage;

// Get the balance trace for the caller
const inputTokenBalance = inputTokenStorage?.balances.trace.find((t) => t.path[0].key === caller);
const outputTokenBalance = outputTokenStorage?.balances.trace.find((t) => t.path[0].key === caller);

// Log the balance changes
console.log(
  `Input token balance change: ${inputTokenBalance?.current?.decoded} -> ${inputTokenBalance?.next?.decoded}`,
);
console.log(
  `Output token balance change: ${outputTokenBalance?.current?.decoded} -> ${outputTokenBalance?.next?.decoded}`,
);
// [!endregion trace-parse]
