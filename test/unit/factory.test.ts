import { Address } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getArraySlotHex, getClient, getSlotHex, toEvenHex } from "@test/utils";
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
      const factoryAddress = Factory.address.toLowerCase() as Address;
      expect(traceWrite[factoryAddress].storage).toEqual(
        expectedStorage(LAYOUTS.Factory, {
          createdContracts: {
            name: "createdContracts",
            type: "address[]",
            kind: "dynamic_array",
            trace: [
              // Array length update
              {
                current: { hex: toEvenHex(0), decoded: 0n },
                next: { hex: toEvenHex(1), decoded: 1n },
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
                current: { hex: toEvenHex(0), decoded: "0x0000000000000000000000000000000000000000" },
                next: { hex: expect.any(String), decoded: expect.any(String) },
                modified: true,
                slots: [getArraySlotHex(getSlotHex(0), 0)],
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
      expect(traceWrite[factoryAddress].intrinsic.nonce).toEqual({ current: 0n, next: 1n });

      // Get the created contract address
      const createdContractAddress = (
        (traceWrite[factoryAddress] as StorageAccessTrace<typeof LAYOUTS.Factory>).storage.createdContracts.trace[1]
          .next?.decoded as Address
      ).toLowerCase() as Address;

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
              current: { hex: toEvenHex(0) },
              next: { hex: toEvenHex(initialValue) },
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
      const factoryAddress = Factory.address.toLowerCase() as Address;
      const createdContractAddress = (
        (createTrace[factoryAddress] as StorageAccessTrace<typeof LAYOUTS.Factory>).storage.createdContracts.trace[1]
          .next?.decoded as Address
      ).toLowerCase() as Address;

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
              current: { hex: toEvenHex(initialValue) },
              next: { hex: toEvenHex(newValue) },
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
              current: { hex: toEvenHex(newValue) },
            },
          ],
        },
      });
    });
  });
});
