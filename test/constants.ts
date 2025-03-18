import * as CONTRACTS from "./contracts";

export { CONTRACTS };

export const FORK_RPC_URL = "https://eth.llamarpc.com";
export const FORK_CONTRACTS = {
  UniswapERC20: CONTRACTS.SimpleERC20.withAddress("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"),
};
