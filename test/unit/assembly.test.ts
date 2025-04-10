import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getClient, getMappingSlotHex, getSlotHex, toEvenHex } from "@test/utils";
import { traceStorageAccess } from "@/index";
import { PathSegmentKind } from "@/lib/slots/types";

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
      expect(writeTrace[AssemblyStorage.address].storage).toEqual(
        expectedStorage(LAYOUTS.AssemblyStorage, {
          value: {
            name: "value",
            type: "uint256",
            kind: "primitive",
            trace: [
              {
                current: { hex: toEvenHex(0), decoded: 0n },
                next: { hex: toEvenHex(123, { size: 32 }), decoded: 123n },
                modified: true,
                slots: [getSlotHex(0)],
                path: [],
                fullExpression: "value",
              },
            ],
          },
        }),
      );

      // Verify the read operation was captured
      expect(readTrace[AssemblyStorage.address].storage).toEqual(
        expectedStorage(LAYOUTS.AssemblyStorage, {
          value: {
            name: "value",
            type: "uint256",
            kind: "primitive",
            trace: [
              {
                current: { hex: toEvenHex(123, { size: 32 }), decoded: 123n },
                modified: false,
                slots: [getSlotHex(0)],
                path: [],
                fullExpression: "value",
              },
            ],
          },
        }),
      );
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
      expect(writeTrace[AssemblyStorage.address].storage).toEqual(
        expectedStorage(LAYOUTS.AssemblyStorage, {
          balances: {
            name: "balances",
            type: "mapping(address => uint256)",
            kind: "mapping",
            trace: [
              {
                current: { hex: toEvenHex(0), decoded: 0n },
                next: { hex: toEvenHex(1000, { size: 32 }), decoded: 1000n },
                modified: true,
                slots: [getMappingSlotHex(1, recipient.toString())],
                path: [
                  {
                    kind: PathSegmentKind.MappingKey,
                    key: recipient.toString(),
                    keyType: "address",
                  },
                ],
                fullExpression: `balances[${recipient.toString()}]`,
              },
            ],
          },
        }),
      );

      // Verify the read operation was captured
      expect(readTrace[AssemblyStorage.address].storage).toEqual(
        expectedStorage(LAYOUTS.AssemblyStorage, {
          balances: {
            name: "balances",
            type: "mapping(address => uint256)",
            kind: "mapping",
            trace: [
              {
                current: { hex: toEvenHex(1000, { size: 32 }), decoded: 1000n },
                modified: false,
                slots: [getMappingSlotHex(1, recipient.toString())],
                path: [
                  {
                    kind: PathSegmentKind.MappingKey,
                    key: recipient.toString(),
                    keyType: "address",
                  },
                ],
                fullExpression: `balances[${recipient.toString()}]`,
              },
            ],
          },
        }),
      );
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

      expect(trace[AssemblyStorage.address].storage).toEqual(
        expectedStorage(LAYOUTS.AssemblyStorage, {
          value: {
            name: "value",
            type: "uint256",
            kind: "primitive",
            trace: [
              {
                current: { hex: toEvenHex(0), decoded: 0n },
                next: { hex: toEvenHex(789, { size: 32 }), decoded: 789n },
                modified: true,
                slots: [getSlotHex(0)],
                path: [],
                fullExpression: "value",
              },
            ],
          },
          balances: {
            name: "balances",
            type: "mapping(address => uint256)",
            kind: "mapping",
            trace: [
              {
                current: { hex: toEvenHex(0), decoded: 0n },
                next: { hex: toEvenHex(222, { size: 32 }), decoded: 222n },
                modified: true,
                slots: [getMappingSlotHex(1, recipient.toString())],
                path: [
                  {
                    kind: PathSegmentKind.MappingKey,
                    key: recipient.toString(),
                    keyType: "address",
                  },
                ],
                fullExpression: `balances[${recipient.toString()}]`,
              },
              {
                current: { hex: toEvenHex(0), decoded: 0n },
                next: { hex: toEvenHex(111, { size: 32 }), decoded: 111n },
                modified: true,
                slots: [getMappingSlotHex(1, caller.toString())],
                path: [
                  {
                    kind: PathSegmentKind.MappingKey,
                    key: caller.toString(),
                    keyType: "address",
                  },
                ],
                fullExpression: `balances[${caller.toString()}]`,
              },
            ],
          },
        }),
      );
    });
  });
});
