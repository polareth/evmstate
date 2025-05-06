import { createMemoryClient, http } from "tevm";
import { mainnet } from "tevm/common";

// [!region client-fork]
const client = createMemoryClient({ // [!code hl]
  common: mainnet, // [!code hl]
  fork: { // [!code hl]
    transport: http("https://1.rpc.thirdweb.com"), // [!code hl]
    blockTag: "latest", // [!code hl]
  }, // [!code hl]
});
// [!endregion watchState]
