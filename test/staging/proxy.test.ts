import { createMemoryClient, http, parseEther } from "tevm";
import { createAddress } from "tevm/address";
import { EthjsAddress } from "tevm/utils";
import { assert, beforeEach, describe, expect, it } from "vitest";

import { FORK } from "@test/constants.js";
import { traceState } from "@/index.js";

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

    // Uniformize the balance of the admin account
    await client.tevmDeal({
      account: admin.toString(),
      amount: parseEther("1"),
    });
  });

  it("should trace storage changes through a proxy", async () => {
    expect(
      await traceState({
        client,
        ...CounterImpl.write.setCount(100n),
        from: admin.toString(),
        to: TransparentProxy.address,
        explorers: mainnet.explorers,
      }),
    ).toMatchSnapshot();
  });

  it("should track proxy-specific storage slots", async () => {
    expect(
      await traceState({
        client,
        ...TransparentProxy.write.changeImplementation(CounterImplV2.address),
        from: admin.toString(),
        to: TransparentProxy.address,
        explorers: mainnet.explorers,
      }),
    ).toMatchSnapshot();
  });
});
