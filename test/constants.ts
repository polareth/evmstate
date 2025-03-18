import { Address } from "tevm";

import * as _contracts from "./contracts";

export const CONTRACTS = Object.values(_contracts).map((contract) =>
  contract.withAddress(
    // Generate a random address
    `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}` as Address,
  ),
);

export const FORK_RPC_URL = "https://eth.llamarpc.com";
export const FORK_CONTRACTS = {
  UniswapERC20: _contracts.SimpleERC20.withAddress("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"),
};
