import { createMemoryClient } from "tevm";
import { EthjsAccount } from "tevm/utils";
import { CALLER } from "@test/constants";

export default async function () {
  const client = createMemoryClient();

  // Initialize the caller account
  const vm = await client.transport.tevm.getVm();
  await vm.stateManager.putAccount(
    CALLER,
    EthjsAccount.fromAccountData({
      balance: 10n,
      nonce: 0n,
    }),
  );
}
