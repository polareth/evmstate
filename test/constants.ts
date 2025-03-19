import { createAddress } from "tevm/address";
import { mainnet } from "tevm/common";

import * as CONTRACTS from "./contracts";

export { CONTRACTS };

export const FORK = {
  mainnet: {
    common: mainnet,
    rpcUrl: process.env.MAINNET_RPC_URL ?? "https://1.rpc.thirdweb.com",
    explorers: {
      etherscan: {
        baseUrl: "https://api.etherscan.io/api",
        apiKey: process.env.MAINNET_ETHERSCAN_API_KEY,
      },
      blockscout: {
        baseUrl: "https://eth.blockscout.com/api",
        apiKey: process.env.MAINNET_BLOCKSCOUT_API_KEY,
      },
    },
    contracts: {
      UniswapERC20: CONTRACTS.SimpleERC20.withAddress("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"),
    },
  },
} as const;

export const ACCOUNTS = {
  caller: createAddress("0x0000000000000000000000000000000000000001"),
  recipient: createAddress("0x0000000000000000000000000000000000000002"),
  admin: createAddress("0x0000000000000000000000000000000000000003"),
};
