import { createMemoryClient, http } from "tevm";
import { mainnet } from "tevm/common";

// @ts-expect-error - 'client' is declared but never used
// [!region client-fork]
const client = createMemoryClient({ // [!code hl]
  common: mainnet, // [!code hl]
  fork: { // [!code hl]
    transport: http("https://1.rpc.thirdweb.com"), // [!code hl]
    blockTag: "latest", // [!code hl]
  }, // [!code hl]
}); // [!code hl]
// [!endregion client-fork]

// @ts-expect-error - 'client' is declared but never used
// [!region client-fork-no-highlight]
const client = createMemoryClient({
  common: mainnet,
  fork: {
    transport: http("https://1.rpc.thirdweb.com"),
    blockTag: "latest",
  },
});
// [!endregion client-fork-no-highlight]
