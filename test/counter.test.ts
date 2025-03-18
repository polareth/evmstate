import { toHex } from "tevm";
import { contract, provider } from "@test/config";
import { getAccessedSlots } from "@test/utils";
import { beforeAll, describe, expect, it } from "vitest";

/* -------------------------------- FUNCTION -------------------------------- */
// TODO: fix exceeds maximum proof window
describe("Counter", () => {
  beforeAll(async () => {
    await provider.tevmSetAccount(contract);
  });

  it("should retrieve number state update", async () => {
    const newNumber = 10n;

    // Execute tx without writing to retrieve access list
    const txTevm = await provider.tevmContract({
      ...contract.write.setNumber(newNumber),
      createAccessList: true,
      createTransaction: true,
    });

    // Get slots that were accessed
    const slots = getAccessedSlots({ address: contract.address, accessList: txTevm.accessList });
    expect(slots).toHaveLength(1); // only one slot is updated (`number`)

    // Verify initial state (before the block including the tx is actually mined)
    expect(await provider.tevmContract(contract.read.getNumber())).toHaveProperty("data", 0n);
    expect(
      await provider.getStorageAt({
        address: contract.address,
        slot: slots[0] ?? "0x",
      }),
    ).toBe(toHex(0n, { size: 32 })); // slot is not initialized yet

    // Mine block to include tx
    await provider.mine({ blocks: 1 });

    // Verify state after tx is mined
    expect(await provider.tevmContract(contract.read.getNumber())).toHaveProperty("data", newNumber);
    expect(
      await provider.getStorageAt({
        address: contract.address,
        slot: slots[0] ?? "0x",
      }),
    ).toBe(toHex(newNumber, { size: 1 }));
  });
});
