import { traceState } from "@/index.js";
import { abi } from "./abi.js";
import { client } from "./client.js";

// @ts-expect-error can't redeclare variable trace
// [!region example-featured]
const trace = await traceState({
  client,
  from: "0x111...",
  to: "0x222...",
  abi: abi,
  functionName: "setBalance",
  args: ["0x333...", 100n],
});
// [!endregion example-featured]

// @ts-expect-error can't redeclare variable trace
// [!region calldata]
const trace = await traceState({
  client,
  from: "0x111...",
  to: "0x222...",
  data: "0xabcd...", // [!code hl]
  value: 0n,
});
// [!endregion calldata]

// @ts-expect-error can't redeclare variable trace
// [!region abi]
const trace = await traceState({
  client,
  from: "0x111...",
  to: "0x222...",
  abi: abi, // [!code hl]
  functionName: "setBalance", // [!code hl]
  args: ["0x333...", 100n], // [!code hl]
});
// [!endregion abi]

// @ts-expect-error can't redeclare variable trace
// [!region txHash]
const trace = await traceState({
  client,
  txHash: "0x1234567890abcdef...", // [!code hl]
});
// [!endregion txHash]

// @ts-expect-error can't redeclare variable trace
// [!region options-client]
const trace = await traceState({
  client, // [!code hl]
  from: "0x111...",
  to: "0x222...",
  data: "0xabcd...",
});
// [!endregion options-client]

// @ts-expect-error can't redeclare variable trace
// [!region options-rpc]
const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com", // [!code hl]
  from: "0x111...",
  to: "0x222...",
  data: "0xabcd...",
});
// [!endregion options-rpc]

// @ts-expect-error can't redeclare variable trace
// [!region options-explorers]
const trace = await traceState({
  client,
  from: "0x111...",
  to: "0x222...",
  data: "0xabcd...",
  explorers: { // [!code hl]
    etherscan: { // [!code hl]
      baseUrl: "https://etherscan.io", // [!code hl]
      apiKey: "your-api-key", // [!code hl]
    }, // [!code hl]
    blockscout: { // [!code hl]
      baseUrl: "https://blockscout.com", // [!code hl]
      apiKey: "your-api-key", // [!code hl]
    }, // [!code hl]
  },
});
// [!endregion options-explorers]
