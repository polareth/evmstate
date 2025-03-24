import { padHex } from "viem";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient, getMappingSlotHex, getSlotHex } from "@test/utils";
import { traceStorageAccess } from "@/index";

const { AssemblyStorage } = CONTRACTS;
const { caller, recipient } = ACCOUNTS;

/**
 * Storage access with assembly & 1-level mappings tests
 *
 * This test suite verifies:
 *
 * 1. Tracing storage operations that use Solidity's assembly (sload/sstore)
 * 2. Capturing direct memory manipulation for storage computation
 * 3. Tracking complex storage access in mappings using assembly
 * 4. Handling batch operations across multiple storage slots
 */
describe("Assembly-based storage access", () => {
  describe("Direct sload/sstore operations", () => {
    it("should trace storage access from assembly sload/sstore operations", async () => {
      const client = getClient();

      // First set the value using assembly
      const writeTrace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: AssemblyStorage.address,
        abi: AssemblyStorage.abi,
        functionName: "setValueAssembly",
        args: [123n],
      });

      // Then read the value using assembly
      const readTrace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: AssemblyStorage.address,
        abi: AssemblyStorage.abi,
        functionName: "getValueAssembly",
        args: [],
      });

      // Verify the write operation was captured
      expect(writeTrace[AssemblyStorage.address].reads).toEqual({});
      expect(writeTrace[AssemblyStorage.address].writes).toEqual({
        [getSlotHex(0)]: [
          {
            label: "value",
            type: "uint256",
            current: { hex: "0x00", decoded: 0n },
            next: { hex: "0x000000000000000000000000000000000000000000000000000000000000007b", decoded: 123n },
          },
        ],
      });

      // Verify the read operation was captured
      expect(readTrace[AssemblyStorage.address].writes).toEqual({});
      expect(readTrace[AssemblyStorage.address].reads).toEqual({
        [getSlotHex(0)]: [
          {
            label: "value",
            type: "uint256",
            current: { hex: "0x000000000000000000000000000000000000000000000000000000000000007b", decoded: 123n },
          },
        ],
      });
    });

    it("should capture complex assembly storage access in mappings", async () => {
      const client = getClient();

      // Set balance for an address using assembly
      const writeTrace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: AssemblyStorage.address,
        abi: AssemblyStorage.abi,
        functionName: "setBalanceAssembly",
        args: [recipient.toString(), 1000n],
      });

      const readTrace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: AssemblyStorage.address,
        abi: AssemblyStorage.abi,
        functionName: "getBalanceAssembly",
        args: [recipient.toString()],
      });

      // Verify the write operation was captured
      expect(writeTrace[AssemblyStorage.address].reads).toEqual({});
      expect(writeTrace[AssemblyStorage.address].writes).toEqual({
        [getMappingSlotHex(1, recipient.toString())]: [
          {
            label: "balances",
            type: "uint256",
            current: { hex: "0x00", decoded: 0n },
            next: { hex: "0x00000000000000000000000000000000000000000000000000000000000003e8", decoded: 1000n },
            keys: [{ hex: padHex(recipient.toString(), { size: 32 }), decoded: recipient.toString(), type: "address" }],
          },
        ],
      });

      // Verify the read operation was captured
      expect(readTrace[AssemblyStorage.address].writes).toEqual({});
      expect(readTrace[AssemblyStorage.address].reads).toEqual({
        [getMappingSlotHex(1, recipient.toString())]: [
          {
            label: "balances",
            type: "uint256",
            current: { hex: "0x00000000000000000000000000000000000000000000000000000000000003e8", decoded: 1000n },
            keys: [{ hex: padHex(recipient.toString(), { size: 32 }), decoded: recipient.toString(), type: "address" }],
          },
        ],
      });
    });

    it("should track batch assembly operations across multiple slots", async () => {
      const client = getClient();

      // Update multiple slots in a single transaction
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: AssemblyStorage.address,
        abi: AssemblyStorage.abi,
        functionName: "batchUpdateAssembly",
        args: [789n, [caller.toString(), recipient.toString()], [111n, 222n]],
      });

      expect(trace[AssemblyStorage.address].reads).toEqual({});
      expect(trace[AssemblyStorage.address].writes).toEqual({
        [getSlotHex(0)]: [
          {
            label: "value",
            type: "uint256",
            current: {
              hex: "0x00",
              decoded: 0n,
            },
            next: {
              hex: "0x0000000000000000000000000000000000000000000000000000000000000315",
              decoded: 789n,
            },
          },
        ],
        [getMappingSlotHex(1, caller.toString())]: [
          {
            label: "balances",
            type: "uint256",
            current: {
              hex: "0x00",
              decoded: 0n,
            },
            next: {
              hex: "0x000000000000000000000000000000000000000000000000000000000000006f",
              decoded: 111n,
            },
            keys: [
              {
                hex: padHex(caller.toString(), { size: 32 }),
                decoded: caller.toString(),
                type: "address",
              },
            ],
          },
        ],
        [getMappingSlotHex(1, recipient.toString())]: [
          {
            label: "balances",
            type: "uint256",
            current: {
              hex: "0x00",
              decoded: 0n,
            },
            next: {
              hex: "0x00000000000000000000000000000000000000000000000000000000000000de",
              decoded: 222n,
            },
            keys: [
              {
                hex: padHex(recipient.toString(), { size: 32 }),
                decoded: recipient.toString(),
                type: "address",
              },
            ],
          },
        ],
      });
    });
  });
});
