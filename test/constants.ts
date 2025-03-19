import { createAddress } from "tevm/address";

import * as CONTRACTS from "./contracts";

export { CONTRACTS };

export const FORK_RPC_URL = "https://1.rpc.thirdweb.com";
export const FORK_CONTRACTS = {
  UniswapERC20: CONTRACTS.SimpleERC20.withAddress("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"),
};

export const CALLER = createAddress("0x0000000000000000000000000000000000000001");
