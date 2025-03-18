import { createMemoryClient, createTevmNode, http } from "tevm";
import { createAddress } from "tevm/address";
import { mainnet } from "tevm/common";

import { Counter } from "./contracts/Counter.s.sol";

/* -------------------------------- CONSTANTS ------------------------------- */
const rpcUrl = "https://eth.llamarpc.com";
const contractAddress = createAddress("0x1111111111111111111111111111111111111111");
export const contract = Counter.withAddress(contractAddress.toString());

const config = {
  common: mainnet,
  fork: {
    transport: http(rpcUrl),
    blockTag: "latest",
  },
} as const;

/* ---------------------------------- SETUP --------------------------------- */
export const node = createTevmNode(config);
export const provider = createMemoryClient(config);
provider.transport.tevm;
