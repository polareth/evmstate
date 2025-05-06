import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS } from "@test/constants.js";
import { getClient } from "@test/utils.js";
import { traceState } from "@/index.js";

const { Arrays } = CONTRACTS;
const { caller } = ACCOUNTS;

/**
 * Arrays tests
 *
 * This test suite verifies:
 *
 * 1. Fixed-size array operations and storage layout
 * 2. Dynamic array operations (push, update, length)
 * 3. Struct array operations with complex data
 * 4. Nested array operations and storage patterns
 * 5. Static arrays of packed types
 * 6. Dynamic array of dynamic types
 */
describe("Arrays", () => {
  describe("Fixed-size arrays", () => {
    it("should trace fixed array slot access", async () => {
      const client = getClient();

      // Set a value in a fixed-size array at index 2
      expect(
        await traceState({
          ...Arrays.write.setFixedArrayValue(2n, 42n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace reading fixed array values", async () => {
      const client = getClient();

      // Test setting a fixed array value
      expect(
        await traceState({
          ...Arrays.write.setFixedArrayValue(2n, 42n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();

      // Actually set the value
      await client.tevmContract({
        ...Arrays.write.setFixedArrayValue(2n, 42n),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Test reading a value
      expect(
        await traceState({
          ...Arrays.read.getFixedArrayValue(2n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("Dynamic arrays", () => {
    it("should trace dynamic array push operation", async () => {
      const client = getClient();

      // Push a value to the dynamic array
      expect(
        await traceState({
          ...Arrays.write.pushToDynamicArray(123n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace dynamic array length access", async () => {
      const client = getClient();

      // First push an element to have a non-zero length
      await client.tevmContract({
        ...Arrays.write.pushToDynamicArray(100n),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Get the array length
      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Arrays.address,
          abi: Arrays.abi,
          functionName: "getDynamicArrayLength",
          args: [],
        }),
      ).toMatchSnapshot();
    });

    it("should trace dynamic array element update", async () => {
      const client = getClient();

      // First push two elements to have something to update
      await client.tevmContract({
        ...Arrays.write.pushToDynamicArray(100n),
        from: caller.toString(),
        addToBlockchain: true,
      });

      await client.tevmContract({
        ...Arrays.write.pushToDynamicArray(200n),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Now update the second element
      expect(
        await traceState({
          ...Arrays.write.updateDynamicArray(1n, 999n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace reading dynamic array element", async () => {
      const client = getClient();

      // First push an element
      await client.tevmContract({
        ...Arrays.write.pushToDynamicArray(100n),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Now read the element
      expect(
        await traceState({
          ...Arrays.read.getDynamicArrayValue(0n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("Struct arrays", () => {
    it("should trace adding struct to array", async () => {
      const client = getClient();

      // Add a struct to the items array
      expect(
        await traceState({
          ...Arrays.write.addItem(42n, "Test item"),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace updating a single field in struct array", async () => {
      const client = getClient();

      // First add a struct to the array
      await client.tevmContract({
        ...Arrays.write.addItem(42n, "Test item"),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Now toggle the active field
      expect(
        await traceState({
          ...Arrays.write.toggleItemActive(0n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace reading struct from array", async () => {
      const client = getClient();

      // First add a struct to the array
      await client.tevmContract({
        ...Arrays.write.addItem(42n, "Test item"),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Now read the struct
      expect(
        await traceState({
          ...Arrays.read.getItem(0n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("Nested arrays", () => {
    it("should trace creating an outer array", async () => {
      const client = getClient();

      // Create an outer array
      expect(
        await traceState({
          client,
          from: caller.toString(),
          to: Arrays.address,
          abi: Arrays.abi,
          functionName: "addNestedArray",
          args: [],
        }),
      ).toMatchSnapshot();
    });

    it("should trace pushing to inner array", async () => {
      const client = getClient();

      // First create an outer array
      await client.tevmContract({
        ...Arrays.write.addNestedArray(),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Now push to the inner array
      expect(
        await traceState({
          ...Arrays.write.pushToNestedArray(0n, 777n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace updating element in nested array", async () => {
      const client = getClient();

      // First create an outer array and push to inner array
      await client.tevmContract({
        ...Arrays.write.addNestedArray(),
        from: caller.toString(),
        addToBlockchain: true,
      });

      await client.tevmContract({
        ...Arrays.write.pushToNestedArray(0n, 777n),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Now update the element
      expect(
        await traceState({
          ...Arrays.write.updateNestedArray(0n, 0n, 888n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace reading element from nested array", async () => {
      const client = getClient();

      // First create an outer array and push to inner array
      await client.tevmContract({
        ...Arrays.write.addNestedArray(),
        from: caller.toString(),
        addToBlockchain: true,
      });

      await client.tevmContract({
        ...Arrays.write.pushToNestedArray(0n, 777n),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Now read the element
      expect(
        await traceState({
          ...Arrays.read.getNestedArrayValue(0n, 0n),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("Non 32-byte arrays", () => {
    it("should trace packed fixed-size arrays", async () => {
      const client = getClient();

      expect(
        await traceState({
          ...Arrays.write.setPackedFixed([1n, 2n], [123n, 456n]),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });

    it("should trace dynamic bytes (> 32 bytes) arrays", async () => {
      const client = getClient();

      // Set a first short value
      await client.tevmContract({
        ...Arrays.write.setBytesDynamic(0n, "0x1234567890"),
        from: caller.toString(),
        addToBlockchain: true,
      });

      // Trace pushing a longer value
      expect(
        await traceState({
          ...Arrays.write.setBytesDynamic(
            0n,
            "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          ),
          client,
          from: caller.toString(),
        }),
      ).toMatchSnapshot();
    });
  });
});
