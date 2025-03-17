import { contract, provider } from "@test/config";
import { getAccessedSlots } from "@test/utils";
import { beforeAll, describe, expect, it } from "vitest";

/* -------------------------------- FUNCTION -------------------------------- */
describe("Counter", () => {
  beforeAll(async () => {
    await provider.tevmSetAccount(contract);
  });

  it("should increment", async () => {
    const txTevm = await provider.tevmContract({
      ...contract.write.setNumber(10n),
      createAccessList: true,
      createTransaction: true,
    });
    await provider.mine({ blocks: 1 });

    const slots = getAccessedSlots({ address: contract.address, accessList: txTevm.accessList });

    const storageValue = await provider.getStorageAt({
      address: contract.address,
      slot: slots[0] ?? "0x",
    });

    const contractValue = (await provider.tevmContract(contract.read.getNumber())).data;

    expect(storageValue).toBe("0x0a");
    expect(contractValue).toEqual(10n);
  });
});
