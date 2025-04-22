import { Hex, toHex } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getArraySlotHex, getClient, getSlotHex } from "@test/utils";
import { traceStorageAccess } from "@/index";
import { PathSegmentKind } from "@/lib/explore/types";
import { StorageAccessTrace } from "@/lib/trace/types";

const { Factory, SimpleContract } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Contract creation tests
 *
 * This test suite verifies:
 *
 * 1. Tracing contract creation from a factory contract
 * 2. Capturing state changes in the factory contract (array updates)
 * 3. Capturing state changes in the created contracts (initialization)
 * 4. Tracing interactions with created contracts
 */
describe("Contract creation", () => {
  describe("Contract creation from a factory contract", () => {
    it("should trace contract creation and factory state changes", async () => {
      const client = getClient();
      const initialValue = 123n;

      // Deploy a contract from the factory
      const traceWrite = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Factory.address,
        abi: Factory.abi,
        functionName: "createContract",
        args: [initialValue],
      });

      // Verify the factory state changes (createdContracts array)
      expect(traceWrite[Factory.address].storage).toEqual(
        expectedStorage(LAYOUTS.Factory, {
          createdContracts: {
            name: "createdContracts",
            type: "address[]",
            kind: "dynamic_array",
            trace: [
              // Array length update
              {
                current: { hex: toHex(0, { size: 1 }), decoded: 0n },
                next: { hex: toHex(1, { size: 1 }), decoded: 1n },
                modified: true,
                slots: [getSlotHex(0)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "createdContracts._length",
              },
              // New contract address added to array
              {
                current: { hex: toHex(0, { size: 1 }), decoded: "0x0000000000000000000000000000000000000000" },
                next: { hex: expect.any(String), decoded: expect.any(String) },
                modified: true,
                slots: [getArraySlotHex({ slot: 0, index: 0 })],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: 0n,
                  },
                ],
                fullExpression: "createdContracts[0]",
              },
            ],
          },
        }),
      );

      // Nonce for the factory contract should be incremented
      expect(traceWrite[Factory.address].intrinsic.nonce).toEqual({ current: 0n, next: 1n });

      // Get the created contract address
      const createdContractAddress = (
        (traceWrite[Factory.address] as StorageAccessTrace<typeof LAYOUTS.Factory>).storage.createdContracts.trace[1]
          .next?.decoded as Hex
      ).toLowerCase() as Hex;

      // Verify the created contract's state changes (not typed as we don't know the layout)
      expect(traceWrite[createdContractAddress].storage).toEqual({
        [`slot_${getSlotHex(0)}`]: {
          name: `slot_${getSlotHex(0)}`,
          trace: [
            {
              modified: true,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: `slot_${getSlotHex(0)}`,
              note: "Could not label this slot access because no layout was found.",
              current: { hex: toHex(0, { size: 1 }) },
              next: { hex: toHex(initialValue) },
            },
          ],
        },
      });
    });

    it("should trace interactions with a created contract", async () => {
      const client = getClient();
      const initialValue = 123n;
      const newValue = 456n;

      // First create a contract
      const createTrace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Factory.address,
        abi: Factory.abi,
        functionName: "createContract",
        args: [initialValue],
      });

      // Get the created contract address
      const createdContractAddress = (
        (createTrace[Factory.address] as StorageAccessTrace<typeof LAYOUTS.Factory>).storage.createdContracts.trace[1]
          .next?.decoded as Hex
      ).toLowerCase() as Hex;

      // Now interact with the created contract
      const interactTrace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: createdContractAddress,
        abi: SimpleContract.abi,
        functionName: "setValue",
        args: [newValue],
      });

      // Verify the state change in the created contract
      expect(interactTrace[createdContractAddress].storage).toEqual({
        [`slot_${getSlotHex(0)}`]: {
          name: `slot_${getSlotHex(0)}`,
          trace: [
            {
              modified: true,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: `slot_${getSlotHex(0)}`,
              note: "Could not label this slot access because no layout was found.",
              current: { hex: toHex(initialValue, { size: 1 }) },
              next: { hex: toHex(newValue, { size: 2 }) },
            },
          ],
        },
      });

      // Read the value from the created contract
      const readTrace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: createdContractAddress,
        abi: SimpleContract.abi,
        functionName: "getValue",
        args: [],
      });

      // Verify the read operation
      expect(readTrace[createdContractAddress].storage).toEqual({
        [`slot_${getSlotHex(0)}`]: {
          name: `slot_${getSlotHex(0)}`,
          trace: [
            {
              modified: false,
              slots: [getSlotHex(0)],
              path: [],
              fullExpression: `slot_${getSlotHex(0)}`,
              note: "Could not label this slot access because no layout was found.",
              current: { hex: toHex(newValue, { size: 2 }) },
            },
          ],
        },
      });
    });
  });
});
