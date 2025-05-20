import { parseEther, type Abi, type ContractFunctionName, type Hex, type MemoryClient } from "tevm";

import { ACCOUNTS, CONTRACTS /* , LAYOUTS */ } from "@test/constants.js";
import { Tracer /* watchState, */, traceState, type TraceStateTxWithAbi } from "@/index.js";

const { Arrays, Bytes, Factory, Mappings, NativeTransfer, StoragePacking, Structs, ETHReceiver } = CONTRACTS;
const { caller, recipient } = ACCOUNTS;

export type SharedArgs = {
  txHash?: Hex;
};

export type Benchmark<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
> = {
  pre?: Array<Omit<TraceStateTxWithAbi<TAbi, TFunctionName>, "from">> | ((client: MemoryClient) => Promise<SharedArgs>);
  bench:
    | Omit<TraceStateTxWithAbi<TAbi, TFunctionName>, "from">
    | ((client: MemoryClient, args: SharedArgs) => Promise<void>);
};

export const BENCHMARKS: Record<string, Array<Benchmark>> = {
  array: [
    { bench: Arrays.write.setFixedArrayValue(2n, 42n) },
    { bench: Arrays.write.pushToDynamicArray(123n) },
    {
      pre: [Arrays.write.pushToDynamicArray(123n), Arrays.write.pushToDynamicArray(456n)],
      bench: Arrays.write.updateDynamicArray(1n, 999n),
    },
    { pre: [Arrays.write.pushToDynamicArray(123n)], bench: Arrays.read.getDynamicArrayValue(0n) },
    { bench: Arrays.write.addItem(42n, "Test item") },
    { pre: [Arrays.write.addItem(42n, "Test item")], bench: Arrays.write.toggleItemActive(0n) },
    { pre: [Arrays.write.addItem(42n, "Test item")], bench: Arrays.read.getItem(0n) },
    { bench: Arrays.write.addNestedArray() },
    { pre: [Arrays.write.addNestedArray()], bench: Arrays.write.pushToNestedArray(0n, 777n) },
    {
      pre: [Arrays.write.addNestedArray(), Arrays.write.pushToNestedArray(0n, 777n)],
      bench: Arrays.write.updateNestedArray(0n, 0n, 888n),
    },
    {
      pre: [Arrays.write.addNestedArray(), Arrays.write.pushToNestedArray(0n, 777n)],
      bench: Arrays.read.getNestedArrayValue(0n, 0n),
    },
    { bench: Arrays.write.setPackedFixed([1n, 2n], [123n, 456n]) },
    { bench: Arrays.write.setBytesDynamic(0n, "0x1234567890") },
    {
      bench: Arrays.write.setBytesDynamic(
        0n,
        "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
      ),
    },
  ],
  bytes: [
    { bench: Bytes.write.setString("short string") },
    { pre: [Bytes.write.setString("short string")], bench: Bytes.read.getString() },
    { bench: Bytes.write.setBytes("0x0102030405") },
    { pre: [Bytes.write.setBytes("0x0102030405")], bench: Bytes.read.getBytes() },
    { pre: [Bytes.write.setString("short string")], bench: Bytes.write.clearString() },
    { pre: [Bytes.write.setBytes("0x0102030405")], bench: Bytes.write.clearBytes() },
    { bench: Bytes.write.setString("a very long string".repeat(10)) },
    { pre: [Bytes.write.setString("a very long string".repeat(10))], bench: Bytes.write.clearString() },
    { bench: Bytes.write.setBytes(`0x${"a".repeat(128)}`) },
    { pre: [Bytes.write.setBytes(`0x${"a".repeat(128)}`)], bench: Bytes.write.clearBytes() },
  ],
  factory: [{ bench: Factory.write.createContract(123n) }],
  mapping: [
    { bench: Mappings.write.setBalance(caller.toString(), 1000n) },
    { pre: [Mappings.write.setBalance(caller.toString(), 1000n)], bench: Mappings.read.getBalance(caller.toString()) },
    { bench: Mappings.write.setAllowance(caller.toString(), recipient.toString(), 1000n) },
    {
      pre: [Mappings.write.setAllowance(caller.toString(), recipient.toString(), 1000n)],
      bench: Mappings.read.getAllowance(caller.toString(), recipient.toString()),
    },
    // This one is way too expensive to run 100x
    // {
    //   bench: Mappings.write.setRidiculouslyNestedMapping(
    //     `0x${"a".repeat(40)}`,
    //     `0x${"b".repeat(40)}`,
    //     `0x${"c".repeat(40)}`,
    //     `0x${"d".repeat(40)}`,
    //     1000n,
    //   ),
    // },
    { bench: Mappings.write.setUserInfo(caller.toString(), 1000n, 12345n, true) },
    { bench: Mappings.write.toggleUserActive(caller.toString()) },
    {
      pre: [
        Mappings.write.setUserInfo(caller.toString(), 1000n, 12345n, true),
        Mappings.write.updateUserBalance(caller.toString(), 300n),
      ],
      bench: Mappings.write.setArrayMapping(1n, 100n),
    },
  ],
  packing: [
    { bench: StoragePacking.write.setSmallValues(42, 123, true, caller.toString()) },
    { bench: StoragePacking.write.setMediumValue1(999) },
    { bench: StoragePacking.write.updateAllValues(10, 20, 1000, 2000, 12345n) },
    { bench: StoragePacking.write.setLargeValue1(123456789012345678901234567890n) },
    { bench: StoragePacking.write.setData("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") },
    {
      pre: [StoragePacking.write.setLargeValue1(123456789012345678901234567890n)],
      bench: StoragePacking.read.getLargeValue1(),
    },
  ],
  replay: [
    {
      pre: async (client) => {
        const { txHash } = await client.tevmContract({
          ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
          from: caller.toString(),
          addToBlockchain: true,
        });

        return { txHash };
      },
      bench: async (client, { txHash }) => {
        if (!txHash) throw new Error("txHash is required");
        await traceState({
          client,
          txHash,
        });
      },
    },
  ],
  struct: [
    { bench: Structs.write.initializeStructs() },
    { pre: [Structs.write.initializeStructs()], bench: Structs.write.deleteStruct() },
    {
      pre: [Structs.write.initializePackedAfterPartial(42, 123, 45678, 1000000, true)],
      bench: Structs.read.getPackedValues(),
    },
    { pre: [Structs.write.addToDynamicArray(42n)], bench: Structs.read.getDynamicArrayLength() },
    { pre: [Structs.write.setFlag(123n, true)], bench: Structs.read.getFlag(123n) },
  ],
  Tracer: [
    {
      bench: async (client) => {
        await new Tracer({ client }).traceState({
          ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
          from: caller.toString(),
        });
      },
    },
    {
      pre: async (client) => {
        const { txHash } = await client.tevmContract({
          ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
          from: caller.toString(),
          addToBlockchain: true,
        });

        return { txHash };
      },
      bench: async (client, { txHash }) => {
        if (!txHash) throw new Error("txHash is required");
        await new Tracer({ client }).traceState({
          txHash,
        });
      },
    },
  ],
  transfer: [
    {
      pre: async (client) => {
        await client.tevmDeal({
          account: NativeTransfer.address,
          amount: parseEther("1"),
        });

        return { txHash: undefined };
      },
      bench: async (client) => {
        await traceState({
          ...NativeTransfer.write.transferEth(ETHReceiver.address, parseEther("1")),
          client,
          from: caller.toString(),
        });
      },
    },
    {
      pre: async (client) => {
        await client.tevmDeal({
          account: caller.toString(),
          amount: parseEther("2"),
        });

        return { txHash: undefined };
      },
      bench: async (client) => {
        await traceState({
          client,
          from: caller.toString(),
          to: recipient.toString(),
          value: parseEther("1"),
        });
      },
    },
  ],
  //   watch: [
  //     async (client) => {
  //       await new Promise<void>(async (resolve, reject) => {
  //         let unsubscribe: () => void | undefined;
  //         let timeout: NodeJS.Timeout | undefined;
  //         unsubscribe = await watchState({
  //           client,
  //           address: StoragePacking.address,
  //           abi: StoragePacking.abi,
  //           storageLayout: LAYOUTS.StoragePacking,
  //           onStateChange: () => {
  //             clearTimeout(timeout);
  //             unsubscribe?.();
  //             resolve();
  //           },
  //         });

  //         timeout = setTimeout(() => {
  //           unsubscribe?.();
  //           reject(new Error("Timeout hit"));
  //         }, 10_000);

  //         await client.tevmContract({
  //           ...StoragePacking.write.setSmallValues(42, 123, true, caller.toString()),
  //           from: caller.toString(),
  //           addToBlockchain: true,
  //         });
  //       });
  //     },
  //     async (client) => {
  //       await new Promise<void>(async (resolve, reject) => {
  //         let unsubscribe: () => void | undefined;
  //         let timeout: NodeJS.Timeout | undefined;
  //         unsubscribe = await watchState({
  //           client,
  //           address: recipient.toString(),
  //           onStateChange: () => {
  //             clearTimeout(timeout);
  //             unsubscribe?.();
  //             resolve();
  //           },
  //         });

  //         timeout = setTimeout(() => {
  //           unsubscribe?.();
  //           reject(new Error("Timeout hit"));
  //         }, 10_000);

  //         await client.tevmCall({
  //           from: caller.toString(),
  //           to: recipient.toString(),
  //           value: 100n,
  //           addToBlockchain: true,
  //         });
  //       });
  //     },
  //   ],
};
