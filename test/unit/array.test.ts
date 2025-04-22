import { toHex } from "tevm";
import { describe, expect, it } from "vitest";

import { ACCOUNTS, CONTRACTS, LAYOUTS } from "@test/constants";
import { expectedStorage, getArraySlotHex, getClient, getSlotHex } from "@test/utils";
import { traceStorageAccess } from "@/index";
import { PathSegmentKind } from "@/lib/explore/types";
import { toHexFullBytes } from "@/lib/explore/utils";

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
 */
describe("Arrays", () => {
  describe("Fixed-size arrays", () => {
    it("should trace fixed array slot access", async () => {
      const client = getClient();
      const index = 2n;
      const value = 42n;

      // Set a value in a fixed-size array at index 2
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "setFixedArrayValue",
        args: [index, value],
      });

      // Verify the write operation was captured
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          fixedArray: {
            name: "fixedArray",
            type: "uint256[5]",
            kind: "static_array",
            trace: [
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(value, { size: 32 }),
                  decoded: value,
                },
                modified: true,
                slots: [getArraySlotHex(0, index, false)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(index),
                  },
                ],
                fullExpression: `fixedArray[${index}]`,
              },
            ],
          },
        }),
      );
    });

    it("should trace reading fixed array values", async () => {
      const client = getClient();
      const index = 2n;
      const value = 42n;

      // First set a value
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "setFixedArrayValue",
        args: [index, value],
      });

      // Now read the value
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "getFixedArrayValue",
        args: [index],
      });

      // Verify the read operation
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          fixedArray: {
            name: "fixedArray",
            type: "uint256[5]",
            kind: "static_array",
            trace: [
              {
                current: {
                  hex: toHex(value, { size: 32 }),
                  decoded: value,
                },
                modified: false,
                slots: [getArraySlotHex(0, index, false)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(index),
                  },
                ],
                fullExpression: `fixedArray[${index}]`,
              },
            ],
          },
        }),
      );
    });
  });

  describe("Dynamic arrays", () => {
    it("should trace dynamic array push operation", async () => {
      const client = getClient();
      const value = 123n;

      // Push a value to the dynamic array
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "pushToDynamicArray",
        args: [value],
      });

      // Dynamic arrays store their length at the base slot (5)
      const lengthSlot = getSlotHex(5);

      // Verify the length update and element addition
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          dynamicArray: {
            name: "dynamicArray",
            type: "uint256[]",
            kind: "dynamic_array",
            trace: [
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: true,
                slots: [lengthSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "dynamicArray._length",
              },
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(value, { size: 32 }),
                  decoded: value,
                },
                modified: true,
                slots: [getArraySlotHex(lengthSlot, 0)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: 0n,
                  },
                ],
                fullExpression: "dynamicArray[0]",
              },
            ],
          },
        }),
      );
    });

    it("should trace dynamic array length access", async () => {
      const client = getClient();

      // First push an element to have a non-zero length
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "pushToDynamicArray",
        args: [100n],
      });

      // Get the array length
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "getDynamicArrayLength",
        args: [],
      });

      // Verify the length read
      const lengthSlot = getSlotHex(5);
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          dynamicArray: {
            name: "dynamicArray",
            type: "uint256[]",
            kind: "dynamic_array",
            trace: [
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [lengthSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "dynamicArray._length",
              },
            ],
          },
        }),
      );
    });

    it("should trace dynamic array element update", async () => {
      const client = getClient();

      // First push two elements to have something to update
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "pushToDynamicArray",
        args: [100n],
      });

      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "pushToDynamicArray",
        args: [200n],
      });

      // Now update the second element
      const updateIndex = 1n;
      const newValue = 999n;

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "updateDynamicArray",
        args: [updateIndex, newValue],
      });

      // Verify the element update
      const lengthSlot = getSlotHex(5);
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          dynamicArray: {
            name: "dynamicArray",
            type: "uint256[]",
            kind: "dynamic_array",
            trace: [
              // Length gets read but doesn't change
              {
                current: {
                  hex: toHex(2, { size: 1 }),
                  decoded: 2n,
                },
                modified: false,
                slots: [lengthSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "dynamicArray._length",
              },
              {
                current: {
                  hex: toHex(200n, { size: 32 }),
                  decoded: 200n,
                },
                next: {
                  hex: toHex(newValue, { size: 32 }),
                  decoded: newValue,
                },
                modified: true,
                slots: [getArraySlotHex(lengthSlot, updateIndex)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(updateIndex),
                  },
                ],
                fullExpression: `dynamicArray[${updateIndex}]`,
              },
            ],
          },
        }),
      );
    });

    it("should trace reading dynamic array element", async () => {
      const client = getClient();
      const index = 0n;
      const value = 100n;

      // First push an element
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "pushToDynamicArray",
        args: [value],
      });

      // Now read the element
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "getDynamicArrayValue",
        args: [index],
      });

      // Verify the read operation
      const lengthSlot = getSlotHex(5);
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          dynamicArray: {
            name: "dynamicArray",
            type: "uint256[]",
            kind: "dynamic_array",
            trace: [
              // Length gets read as well
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [lengthSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "dynamicArray._length",
              },
              {
                current: {
                  hex: toHex(value, { size: 32 }),
                  decoded: value,
                },
                modified: false,
                slots: [getArraySlotHex(lengthSlot, index)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(index),
                  },
                ],
                fullExpression: `dynamicArray[${index}]`,
              },
            ],
          },
        }),
      );
    });
  });

  describe("Struct arrays", () => {
    it("should trace adding struct to array", async () => {
      const client = getClient();
      const id = 42n;
      const name = "Test Item";

      // Add a struct to the items array
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "addItem",
        args: [id, name],
      });

      // The items array starts at slot 6
      const baseSlot = getSlotHex(6);

      // Verify the array length update and struct field writes
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          items: {
            name: "items",
            type: "struct Arrays.Item[]",
            kind: "dynamic_array",
            trace: [
              // Array length update
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: true,
                slots: [baseSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "items._length",
              },
              // id field write
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(id, { size: 32 }),
                  decoded: id,
                },
                modified: true,
                slots: [getArraySlotHex(baseSlot, 0)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: 0n,
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "id",
                  },
                ],
                fullExpression: "items[0].id",
              },
              // name lengthfield write
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(name.length, { size: 1 }),
                  decoded: BigInt(name.length),
                },
                modified: true,
                slots: [getArraySlotHex(baseSlot, 1)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: 0n,
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "name",
                  },
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: "items[0].name._length",
              },
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: "",
                },
                next: {
                  hex: toHexFullBytes(name),
                  decoded: name,
                },
                modified: true,
                slots: [getArraySlotHex(baseSlot, 1)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: 0n,
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "name",
                  },
                ],
                fullExpression: "items[0].name",
              },
              // active field write
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: false,
                },
                next: {
                  hex: toHex(1, { size: 1 }),
                  decoded: true,
                },
                modified: true,
                slots: [getArraySlotHex(baseSlot, 2)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: 0n,
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "active",
                  },
                ],
                fullExpression: "items[0].active",
              },
            ],
          },
        }),
      );
    });

    it("should trace updating a single field in struct array", async () => {
      const client = getClient();
      const id = 42n;
      const name = "Test Item";

      // First add a struct to the array
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "addItem",
        args: [id, name],
      });

      // Now toggle the active field
      const index = 0n;
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "toggleItemActive",
        args: [index],
      });

      // Verify only the active field is updated
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          items: {
            name: "items",
            type: "struct Arrays.Item[]",
            kind: "dynamic_array",
            trace: [
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [getSlotHex(6)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "items._length",
              },
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: true,
                },
                next: {
                  hex: toHex(0, { size: 1 }),
                  decoded: false,
                },
                modified: true,
                slots: [getArraySlotHex(getSlotHex(6), 2)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(index),
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "active",
                  },
                ],
                fullExpression: `items[${index}].active`,
              },
            ],
          },
        }),
      );
    });

    it("should trace reading struct from array", async () => {
      const client = getClient();
      const id = 42n;
      const name = "Test Item";

      // First add a struct to the array
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "addItem",
        args: [id, name],
      });

      // Now read the struct
      const index = 0n;
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "getItem",
        args: [index],
      });

      // Verify all struct fields are read
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          items: {
            name: "items",
            type: "struct Arrays.Item[]",
            kind: "dynamic_array",
            trace: [
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [getSlotHex(6)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "items._length",
              },
              // id field read
              {
                current: {
                  hex: toHex(id, { size: 32 }),
                  decoded: id,
                },
                modified: false,
                slots: [getArraySlotHex(getSlotHex(6), 0)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(index),
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "id",
                  },
                ],
                fullExpression: `items[${index}].id`,
              },
              // name length field read
              {
                current: {
                  hex: toHex(name.length, { size: 1 }),
                  decoded: BigInt(name.length),
                },
                modified: false,
                slots: [getArraySlotHex(getSlotHex(6), 1)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(index),
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "name",
                  },
                  {
                    kind: PathSegmentKind.BytesLength,
                    name: "_length",
                  },
                ],
                fullExpression: `items[${index}].name._length`,
              },
              // name field read
              {
                current: {
                  hex: toHexFullBytes(name),
                  decoded: name,
                },
                modified: false,
                slots: [getArraySlotHex(getSlotHex(6), 1)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(index),
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "name",
                  },
                ],
                fullExpression: `items[${index}].name`,
              },
              // The active field read
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: true,
                },
                modified: false,
                slots: [getArraySlotHex(getSlotHex(6), 2)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(index),
                  },
                  {
                    kind: PathSegmentKind.StructField,
                    name: "active",
                  },
                ],
                fullExpression: `items[${index}].active`,
              },
            ],
          },
        }),
      );
    });
  });

  describe("Nested arrays", () => {
    it("should trace creating an outer array", async () => {
      const client = getClient();

      // Create an outer array
      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "addNestedArray",
        args: [],
      });

      // The nestedArrays array starts at slot 7
      const lengthSlot = getSlotHex(7);

      // Verify the length update
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          nestedArrays: {
            name: "nestedArrays",
            type: "uint256[][]",
            kind: "dynamic_array",
            trace: [
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: true,
                slots: [lengthSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "nestedArrays._length",
              },
            ],
          },
        }),
      );
    });

    it("should trace pushing to inner array", async () => {
      const client = getClient();

      // First create an outer array
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "addNestedArray",
        args: [],
      });

      // Now push to the inner array
      const outerIndex = 0n;
      const value = 777n;

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "pushToNestedArray",
        args: [outerIndex, value],
      });

      // Verify the inner array length update and element addition
      const baseSlot = getSlotHex(7);
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          nestedArrays: {
            name: "nestedArrays",
            type: "uint256[][]",
            kind: "dynamic_array",
            trace: [
              // The outer array read
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [baseSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "nestedArrays._length",
              },
              // The inner array length update
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: true,
                slots: [getArraySlotHex(baseSlot, outerIndex)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(outerIndex),
                  },
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: `nestedArrays[${outerIndex}]._length`,
              },
              // The element addition
              {
                current: {
                  hex: toHex(0, { size: 1 }),
                  decoded: 0n,
                },
                next: {
                  hex: toHex(value, { size: 32 }),
                  decoded: value,
                },
                modified: true,
                slots: [getArraySlotHex(getArraySlotHex(baseSlot, outerIndex), 0)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(outerIndex),
                  },
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: 0n,
                  },
                ],
                fullExpression: `nestedArrays[${outerIndex}][0]`,
              },
            ],
          },
        }),
      );
    });

    it("should trace updating element in nested array", async () => {
      const client = getClient();

      // First create an outer array and push to inner array
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "addNestedArray",
        args: [],
      });

      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "pushToNestedArray",
        args: [0n, 777n],
      });

      // Now update the element
      const outerIndex = 0n;
      const innerIndex = 0n;
      const newValue = 888n;

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "updateNestedArray",
        args: [outerIndex, innerIndex, newValue],
      });

      // Verify the element update
      const baseSlot = getSlotHex(7);
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          nestedArrays: {
            name: "nestedArrays",
            type: "uint256[][]",
            kind: "dynamic_array",
            trace: [
              // The outer array lengthread
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [baseSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "nestedArrays._length",
              },
              // The inner array length update
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [getArraySlotHex(baseSlot, outerIndex)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(outerIndex),
                  },
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: `nestedArrays[${outerIndex}]._length`,
              },
              // The element update
              {
                current: {
                  hex: toHex(777n, { size: 32 }),
                  decoded: 777n,
                },
                next: {
                  hex: toHex(newValue, { size: 32 }),
                  decoded: newValue,
                },
                modified: true,
                slots: [getArraySlotHex(getArraySlotHex(baseSlot, outerIndex), innerIndex)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(outerIndex),
                  },
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(innerIndex),
                  },
                ],
                fullExpression: `nestedArrays[${outerIndex}][${innerIndex}]`,
              },
            ],
          },
        }),
      );
    });

    it("should trace reading element from nested array", async () => {
      const client = getClient();
      const value = 777n;

      // First create an outer array and push to inner array
      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "addNestedArray",
        args: [],
      });

      await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "pushToNestedArray",
        args: [0n, value],
      });

      // Now read the element
      const outerIndex = 0n;
      const innerIndex = 0n;

      const trace = await traceStorageAccess({
        client,
        from: caller.toString(),
        to: Arrays.address,
        abi: Arrays.abi,
        functionName: "getNestedArrayValue",
        args: [outerIndex, innerIndex],
      });

      // Verify the read operation
      const baseSlot = getSlotHex(7);
      expect(trace[Arrays.address].storage).toEqual(
        expectedStorage(LAYOUTS.Arrays, {
          nestedArrays: {
            name: "nestedArrays",
            type: "uint256[][]",
            kind: "dynamic_array",
            trace: [
              // The outer array length read
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [baseSlot],
                path: [
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: "nestedArrays._length",
              },
              // The inner array length read
              {
                current: {
                  hex: toHex(1, { size: 1 }),
                  decoded: 1n,
                },
                modified: false,
                slots: [getArraySlotHex(baseSlot, outerIndex)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(outerIndex),
                  },
                  {
                    kind: PathSegmentKind.ArrayLength,
                    name: "_length",
                  },
                ],
                fullExpression: `nestedArrays[${outerIndex}]._length`,
              },
              // The element read
              {
                current: {
                  hex: toHex(777n, { size: 32 }),
                  decoded: 777n,
                },
                modified: false,
                slots: [getArraySlotHex(getArraySlotHex(baseSlot, outerIndex), innerIndex)],
                path: [
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(outerIndex),
                  },
                  {
                    kind: PathSegmentKind.ArrayIndex,
                    index: BigInt(innerIndex),
                  },
                ],
                fullExpression: `nestedArrays[${outerIndex}][${innerIndex}]`,
              },
            ],
          },
        }),
      );
    });
  });
});
