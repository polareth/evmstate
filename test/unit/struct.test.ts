import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants";
import { getClient } from "@test/utils";
import { traceState } from "@/index";

const { Structs } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Structs tests
 *
 * This test suite verifies:
 *
 * 1. Basic struct operations (setting, getting, updating fields)
 * 2. Packed struct operations and storage layout
 * 3. Nested struct operations
 * 4. Structs with dynamic types (arrays, mappings)
 * 5. Memory vs storage behavior
 * 6. Struct deletion
 */
describe("Structs", () => {
  describe("Basic struct operations", () => {
    it("should trace basic struct storage access", async () => {
      const client = getClient();

      // Set a basic struct
      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Structs.address,
          abi: Structs.abi,
          functionName: "initializeStructs",
          args: [],
        }),
      ).toMatchSnapshot();
    });

    it("should trace struct deletion", async () => {
      const client = getClient();

      // First initialize the struct
      await client.tevmContract({
        ...Structs.write.initializeStructs(),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Now delete the struct
      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Structs.address,
          abi: Structs.abi,
          functionName: "deleteStruct",
          args: [],
        }),
      ).toMatchSnapshot();
    });
  });

  describe("Packed struct operations", () => {
    it("should trace packed struct with preceding value", async () => {
      const client = getClient();

      // Set packed struct with preceding value
      expect(
        await traceState({
          ...Structs.write.initializePackedAfterPartial(42, 123, 45678, 1000000, true),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace reading packed struct values", async () => {
      const client = getClient();

      // First set up the packed struct
      await client.tevmContract({
        ...Structs.write.initializePackedAfterPartial(42, 123, 45678, 1000000, true),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Read the packed struct values
      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Structs.address,
          abi: Structs.abi,
          functionName: "getPackedValues",
          args: [],
        }),
      ).toMatchSnapshot();
    });
  });

  describe("Struct with dynamic types", () => {
    it("should trace dynamic array in struct", async () => {
      const client = getClient();

      // First initialize the struct
      await client.tevmContract({
        ...Structs.write.initializeStructs(),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Add to dynamic array in struct
      expect(
        await traceState({
          ...Structs.write.addToDynamicArray(42n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace array length in struct", async () => {
      const client = getClient();

      // First add an element to the array
      await client.tevmContract({
        ...Structs.write.addToDynamicArray(42n),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Get the array length
      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Structs.address,
          abi: Structs.abi,
          functionName: "getDynamicArrayLength",
          args: [],
        }),
      ).toMatchSnapshot();
    });

    it("should trace mapping operations in struct", async () => {
      const client = getClient();
      const key = 123n;
      const value = true;

      // Set a flag in the mapping
      expect(
        await traceState({
          ...Structs.write.setFlag(123n, true),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();

      // Run the tx
      await client.tevmContract({
        ...Structs.write.setFlag(123n, true),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Read the flag
      expect(
        await traceState({
          ...Structs.read.getFlag(123n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });
  });
});
