import { createAddress } from "tevm/address";
import { EthjsAccount, parseEther } from "tevm/utils";
import { beforeAll, describe, it } from "vitest";

import { CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";

const { NativeTransfer, ETHReceiver } = CONTRACTS;

// TODO: also test with a contract sending native tokens to an EOA
describe("native-transfers", () => {
  beforeAll(async () => {
    const client = getClient();

    // Fund the NativeTransfer contract with ETH
    const vm = await client.transport.tevm.getVm();
    await vm.stateManager.putAccount(
      createAddress(NativeTransfer.address),
      EthjsAccount.fromAccountData({
        balance: parseEther("10"),
        nonce: 0n,
      }),
    );
  });

  it.todo("should track ETH balance changes in sender contract");
  it.todo("should track ETH balance changes in recipient contract");
  it.todo("should capture storage changes from the transfer tracking mapping");
  it.todo("should show differences between transfer/send/call methods");
  it.todo("should capture receive/fallback function storage updates");
  it.todo("should capture account state changes from native transfers");
});
