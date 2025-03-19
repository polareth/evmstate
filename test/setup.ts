import { createMemoryClient } from "tevm";
import { EthjsAccount, parseEther } from "tevm/utils";
import { ACCOUNTS } from "@test/constants";

export default async function () {
  const client = createMemoryClient();

  // Initialize accounts
  const vm = await client.transport.tevm.getVm();
  await Promise.all(
    Object.values(ACCOUNTS).map((account) =>
      vm.stateManager.putAccount(
        account,
        EthjsAccount.fromAccountData({
          balance: parseEther("10"),
          nonce: 0n,
        }),
      ),
    ),
  );
}
