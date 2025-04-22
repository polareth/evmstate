import { createAddress } from "tevm/address";
import { mainnet } from "tevm/common";

import * as contracts from "./contracts";

export * as LAYOUTS from "./generated/layouts";

export const CONTRACTS = {
  AssemblyStorage: contracts.AssemblyStorage.withAddress(`0x${"1".repeat(40)}`),
  StoragePacking: contracts.StoragePacking.withAddress(`0x${"2".repeat(40)}`),
  Arrays: contracts.Arrays.withAddress(`0x${"3".repeat(40)}`),
  Mappings: contracts.Mappings.withAddress(`0x${"4".repeat(40)}`),
  Structs: contracts.Structs.withAddress(`0x${"5".repeat(40)}`),
  Factory: contracts.Factory.withAddress(`0x${"6".repeat(40)}`),
  SimpleContract: contracts.SimpleContract.withAddress(`0x${"7".repeat(40)}`),
  NativeTransfer: contracts.NativeTransfer.withAddress(`0x${"8".repeat(40)}`),
  ETHReceiver: contracts.ETHReceiver.withAddress(`0x${"9".repeat(40)}`),
  Bytes: contracts.Bytes.withAddress(`0x${"a".repeat(40)}`),
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
