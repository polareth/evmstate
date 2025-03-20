import { createMemoryClient, encodeFunctionData } from "tevm";
import { describe, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";
import { traceStorageAccess } from "@/index";

const { MultiSlot, StoragePacking } = CONTRACTS;
const { caller } = ACCOUNTS;

describe("basic", () => {
  it("should get access list from transaction data", async () => {
    const client = getClient();

    const trace = await traceStorageAccess({
      client,
      from: caller.toString(),
      to: MultiSlot.address,
      data: encodeFunctionData(MultiSlot.write.setMultipleValues(1n, 2n, 3n)),
    });

    console.log(JSON.stringify(trace, null, 2));

    // Print out detailed information about storage slot labels
    // console.log("\n--- Storage Access Labels ---");
    // Object.entries(trace).forEach(([address, t]) => {
    //   console.log(`\nContract Address: ${address}`);

    //   // Display labeled reads
    //   console.log("\nREADS:");
    //   if (Object.keys(t.reads).length === 0) {
    //     console.log("  None");
    //   } else {
    //     Object.entries(t.reads).forEach(([slot, info]) => {
    //       console.log(`  Slot: ${slot}`);
    //       console.log(`  Label: ${info.label || "unknown"}`);
    //       console.log(`  Match Type: ${info.match || "none"}`);
    //       if (info.keyInfo) {
    //         console.log(`  Key: ${JSON.stringify(info.keyInfo.key)}`);
    //         console.log(`  Key Type: ${info.keyInfo.type}`);
    //       }
    //       console.log("  ---");
    //     });
    //   }

    //   // Display labeled writes
    //   console.log("\nWRITES:");
    //   if (Object.keys(t.writes).length === 0) {
    //     console.log("  None");
    //   } else {
    //     Object.entries(t.writes).forEach(([slot, info]) => {
    //       console.log(`  Slot: ${slot}`);
    //       console.log(`  Label: ${info.label || "unknown"}`);
    //       console.log(`  Match Type: ${info.match || "none"}`);
    //       if (info.keyInfo) {
    //         console.log(`  Key: ${JSON.stringify(info.keyInfo.key)}`);
    //         console.log(`  Key Type: ${info.keyInfo.type}`);
    //       }
    //       console.log(`  Old Value: ${info.oldValue}`);
    //       console.log(`  New Value: ${info.newValue}`);
    //       console.log("  ---");
    //     });
    //   }
    // });
  });

  it.todo("should get access list from past transaction");
  it.todo("should capture single slot updates");
  it.todo("should capture multiple slot updates in one transaction");
  it.todo("should track reads vs writes separately");
  it.todo("should handle packed storage variables correctly");
  it.todo("should detect account state changes (nonce, balance)");
});
