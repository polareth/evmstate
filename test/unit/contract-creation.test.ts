import { encodeFunctionData } from "tevm";
import { padHex } from "viem";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient, getMappingSlotHex, getSlotHex } from "@test/utils";
import { traceStorageAccess } from "@/index";

const { Factory } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Contract creation tests
 *
 * This test suite verifies:
 *
 * 1. Tracing contract creation
 * 2. Capturing state changes in the factory contract
 * 3. Capturing state changes in the created contracts
 * 4. Tracing contract creation with direct calldata
 */
describe("Contract creation", () => {
  describe("Contract creation from a factory contract", () => {
    it("should trace TODO", async () => {
      const client = getClient();

      // Deploy a contract from the factory
      const traceWrite = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Factory.address,
        abi: Factory.abi,
        functionName: "createContract",
        args: [123n],
      });

      console.log(traceWrite);

      // // Then read the value using assembly
      // const traceRead = await traceStorageAccess({
      //   client,
      //   from: caller.toString(),
      //   to: AssemblyStorage.address,
      //   data: encodeFunctionData(AssemblyStorage.read.getValueAssembly()),
      // });

      // // Verify the write operation was captured
      // expect(traceWrite[AssemblyStorage.address].reads).toEqual({});
      // expect(traceWrite[AssemblyStorage.address].writes).toEqual({
      //   [getSlotHex(0)]: [
      //     {
      //       label: "value",
      //       type: "uint256",
      //       current: { hex: "0x00", decoded: 0n },
      //       next: { hex: "0x000000000000000000000000000000000000000000000000000000000000007b", decoded: 123n },
      //     },
      //   ],
      // });

      // // Verify the read operation was captured
      // expect(traceRead[AssemblyStorage.address].writes).toEqual({});
      // expect(traceRead[AssemblyStorage.address].reads).toEqual({
      //   [getSlotHex(0)]: [
      //     {
      //       label: "value",
      //       type: "uint256",
      //       current: { hex: "0x000000000000000000000000000000000000000000000000000000000000007b", decoded: 123n },
      //     },
      //   ],
      // });
    });
  });
});
