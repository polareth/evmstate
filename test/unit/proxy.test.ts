import { createMemoryClient, encodeFunctionData, Hex, http } from "tevm";
import { createAddress } from "tevm/address";
import { EthjsAddress } from "tevm/utils";
import { assert, beforeEach, describe, expect, it } from "vitest";

import { FORK, LAYOUTS } from "@test/constants";
import { solidityDebugger } from "@test/debugger";
import { expectedStorage, getSlotHex, toEvenHex } from "@test/utils";
import { traceStorageAccess } from "@/index";

const { TransparentProxy, CounterImpl, CounterImplV2 } = FORK.mainnet.contracts;

const mainnet = FORK.mainnet;
const client = createMemoryClient({
  common: mainnet.common,
  fork: {
    transport: http(mainnet.rpcUrl),
    blockTag: "latest",
  },
});

describe("Proxies", () => {
  let admin: EthjsAddress;

  beforeEach(async () => {
    const res = await client.tevmContract(TransparentProxy.read.getAdmin());
    assert(res.data, "Could not get proxy admin");
    admin = createAddress(res.data);
  });

  it("should trace storage changes through a proxy", async () => {
    const trace = await traceStorageAccess({
      client,
      from: admin.toString(),
      to: TransparentProxy.address,
      abi: CounterImpl.abi,
      functionName: "setCount",
      args: [100n],
      explorers: mainnet.explorers,
    });

    expect(trace[TransparentProxy.address.toLowerCase() as Hex].storage).toEqual(
      expectedStorage(LAYOUTS.CounterImpl, {
        _count: {
          name: "_count",
          type: "uint256",
          kind: "primitive",
          trace: [
            {
              current: { hex: toEvenHex(0, { size: 32 }), decoded: 0n },
              next: { hex: toEvenHex(100, { size: 32 }), decoded: 100n },
              modified: true,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: "_count",
            },
          ],
        },
        // @ts-expect-error __implementation field does not exist
        __implementation: {
          name: "__implementation",
          type: "address",
          kind: "primitive",
          trace: [
            {
              current: { hex: CounterImpl.address.toLowerCase(), decoded: CounterImpl.address },
              modified: false,
              slots: ["0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"],
              path: [],
              fullExpression: "__implementation",
            },
          ],
        },
      }),
    );
  });

  it("should track proxy-specific storage slots", async () => {
    const trace = await traceStorageAccess({
      client,
      from: admin.toString(),
      to: TransparentProxy.address,
      abi: TransparentProxy.abi,
      functionName: "changeImplementation",
      args: [CounterImplV2.address],
      explorers: mainnet.explorers,
    });

    expect(trace[TransparentProxy.address.toLowerCase() as Hex].storage).toEqual(
      expectedStorage(LAYOUTS.CounterImpl, {
        // @ts-expect-error __implementation field does not exist
        __implementation: {
          name: "__implementation",
          type: "address",
          kind: "primitive",
          trace: [
            {
              current: { hex: CounterImpl.address.toLowerCase(), decoded: CounterImpl.address },
              next: { hex: CounterImplV2.address.toLowerCase(), decoded: CounterImplV2.address },
              modified: true,
              slots: ["0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"],
              path: [],
              fullExpression: "__implementation",
            },
          ],
        },
        __admin: {
          name: "__admin",
          type: "address",
          kind: "primitive",
          trace: [
            {
              current: { hex: admin.toString().toLowerCase(), decoded: admin.toString() },
              modified: false,
              slots: ["0xb53127684a568b3173ae13b9f8a6016e019b2c8e8cbb2a6e0a23387fdaa12345"],
              path: [],
              fullExpression: "__admin",
            },
          ],
        },
      }),
    );
  });

  it("should retrieve new storage layout when implementation is upgraded", async () => {
    // Update count
    await client.tevmCall({
      caller: admin.toString(),
      to: TransparentProxy.address,
      data: encodeFunctionData({
        abi: CounterImpl.abi,
        functionName: "setCount",
        args: [100n],
      }),
      addToBlockchain: true,
    });

    // Update implementation
    await client.tevmCall({
      from: admin.toString(),
      to: TransparentProxy.address,
      data: encodeFunctionData({
        abi: TransparentProxy.abi,
        functionName: "changeImplementation",
        args: [CounterImplV2.address],
      }),
      addToBlockchain: true,
    });

    const trace = await traceStorageAccess({
      client,
      from: admin.toString(),
      to: TransparentProxy.address,
      abi: CounterImplV2.abi,
      functionName: "setCount",
      args: [200n],
      explorers: mainnet.explorers,
    });

    expect(trace[TransparentProxy.address.toLowerCase() as Hex].storage).toEqual(
      expectedStorage(LAYOUTS.CounterImplV2, {
        _count: {
          name: "_count",
          type: "uint256",
          kind: "primitive",
          trace: [
            {
              current: { hex: toEvenHex(100, { size: 32 }), decoded: 100n },
              next: { hex: toEvenHex(200, { size: 32 }), decoded: 200n },
              modified: true,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: "_count",
            },
          ],
        },
        _paused: {
          name: "_paused",
          type: "bool",
          kind: "primitive",
          trace: [
            {
              current: { hex: toEvenHex(0), decoded: false },
              modified: false,
              slots: [getSlotHex(1)],
              path: [],
              fullExpression: "_paused",
            },
          ],
        },
        // @ts-expect-error __implementation field does not exist
        __implementation: {
          name: "__implementation",
          type: "address",
          kind: "primitive",
          trace: [
            {
              current: { hex: CounterImplV2.address.toLowerCase(), decoded: CounterImplV2.address },
              modified: false,
              slots: ["0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"],
              path: [],
              fullExpression: "__implementation",
            },
          ],
        },
      }),
    );
  });
});
