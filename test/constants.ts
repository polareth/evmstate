import { toHex } from "tevm";
import { createAddress } from "tevm/address";
import { mainnet } from "tevm/common";

import * as contracts from "./contracts/index.js";

export * as LAYOUTS from "./codegen/layouts/index.js";

export const CONTRACTS = {
  StoragePacking: contracts.StoragePacking.withAddress(toHex("StoragePacking", { size: 20 })),
  Arrays: contracts.Arrays.withAddress(toHex("Arrays", { size: 20 })),
  Mappings: contracts.Mappings.withAddress(toHex("Mappings", { size: 20 })),
  Structs: contracts.Structs.withAddress(toHex("Structs", { size: 20 })),
  Factory: contracts.Factory.withAddress(toHex("Factory", { size: 20 })),
  SimpleContract: contracts.SimpleContract.withAddress(toHex("SimpleContract", { size: 20 })),
  NativeTransfer: contracts.NativeTransfer.withAddress(toHex("NativeTransfer", { size: 20 })),
  ETHReceiver: contracts.ETHReceiver.withAddress(toHex("ETHReceiver", { size: 20 })),
  Bytes: contracts.Bytes.withAddress(toHex("Bytes", { size: 20 })),
};

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
      TransparentProxy: contracts.TransparentProxy.withAddress("0x6F64746625f57a146A8F2168852d73dfec6771e8"),
      CounterImpl: contracts.CounterImpl.withAddress("0x47676f15E78BfFE13225eFF46C6A2BDd3199ed95"),
      CounterImplV2: contracts.CounterImplV2.withAddress("0xCC0eAE411714557Ac10A0b3F310d17AA1C72A360"),
    },
  },
} as const;

export const ACCOUNTS = {
  caller: createAddress("0x0000000000000000000000000000000000000001"),
  recipient: createAddress("0x0000000000000000000000000000000000000002"),
};
