import { Hex } from "tevm";
import { describe, it } from "vitest";

import { createStorageLayoutAdapter } from "@/lib/adapter";

// Example storage layout from a Solidity contract
const layout = {
  storage: [
    {
      astId: 15,
      contract: "fileA:A",
      label: "x",
      offset: 0,
      slot: "0",
      type: "t_uint256",
    },
    {
      astId: 19,
      contract: "fileA:A",
      label: "w",
      offset: 0,
      slot: "1",
      type: "t_uint256",
    },
    {
      astId: 24,
      contract: "fileA:A",
      label: "s",
      offset: 0,
      slot: "2",
      type: "t_struct(S)13_storage",
    },
    {
      astId: 26,
      contract: "fileA:A",
      label: "addr",
      offset: 0,
      slot: "6",
      type: "t_address",
    },
    {
      astId: 34,
      contract: "fileA:A",
      label: "map",
      offset: 0,
      slot: "7",
      type: "t_mapping(t_uint256,t_mapping(t_address,t_bool))",
    },
    {
      astId: 37,
      contract: "fileA:A",
      label: "array",
      offset: 0,
      slot: "8",
      type: "t_array(t_uint256)dyn_storage",
    },
    {
      astId: 39,
      contract: "fileA:A",
      label: "s1",
      offset: 0,
      slot: "9",
      type: "t_string_storage",
    },
    {
      astId: 41,
      contract: "fileA:A",
      label: "b1",
      offset: 0,
      slot: "10",
      type: "t_bytes_storage",
    },
  ],
  types: {
    t_address: {
      encoding: "inplace",
      label: "address",
      numberOfBytes: "20",
    },
    "t_array(t_uint256)2_storage": {
      base: "t_uint256",
      encoding: "inplace",
      label: "uint256[2]",
      numberOfBytes: "64",
    },
    "t_array(t_uint256)dyn_storage": {
      base: "t_uint256",
      encoding: "dynamic_array",
      label: "uint256[]",
      numberOfBytes: "32",
    },
    t_bool: {
      encoding: "inplace",
      label: "bool",
      numberOfBytes: "1",
    },
    t_bytes_storage: {
      encoding: "bytes",
      label: "bytes",
      numberOfBytes: "32",
    },
    "t_mapping(t_address,t_bool)": {
      encoding: "mapping",
      key: "t_address",
      label: "mapping(address => bool)",
      numberOfBytes: "32",
      value: "t_bool",
    },
    "t_mapping(t_uint256,t_mapping(t_address,t_bool))": {
      encoding: "mapping",
      key: "t_uint256",
      label: "mapping(uint256 => mapping(address => bool))",
      numberOfBytes: "32",
      value: "t_mapping(t_address,t_bool)",
    },
    t_string_storage: {
      encoding: "bytes",
      label: "string",
      numberOfBytes: "32",
    },
    "t_struct(S)13_storage": {
      encoding: "inplace",
      label: "struct A.S",
      members: [
        {
          astId: 3,
          contract: "fileA:A",
          label: "a",
          offset: 0,
          slot: "0",
          type: "t_uint128",
        },
        {
          astId: 5,
          contract: "fileA:A",
          label: "b",
          offset: 16,
          slot: "0",
          type: "t_uint128",
        },
        {
          astId: 9,
          contract: "fileA:A",
          label: "staticArray",
          offset: 0,
          slot: "1",
          type: "t_array(t_uint256)2_storage",
        },
        {
          astId: 12,
          contract: "fileA:A",
          label: "dynArray",
          offset: 0,
          slot: "3",
          type: "t_array(t_uint256)dyn_storage",
        },
      ],
      numberOfBytes: "128",
    },
    t_uint128: {
      encoding: "inplace",
      label: "uint128",
      numberOfBytes: "16",
    },
    t_uint256: {
      encoding: "inplace",
      label: "uint256",
      numberOfBytes: "32",
    },
  },
} as const;

// Create the typed storage layout
const typedLayout = createStorageLayoutAdapter(layout);

/** Test function to execute all examples */
describe("Storage layout access", () => {
  it.skip("should access storage layout", async () => {
    console.log("Running examples to test storage layout access...");

    // Example 1: Reading a uint256 value
    const xValue = await typedLayout.x.getData();
    console.log("1. x (uint256):", xValue);

    // Example 2: Reading an address value
    const addrValue = await typedLayout.addr.getData();
    console.log("2. addr (address):", addrValue);

    // Example 3: Reading from a nested mapping
    const mapValue = await typedLayout.map.getData({
      keys: [1n, "0x0000000000000000000000000000000000000001" as Hex],
    });
    console.log("3. map[1][0x...001] (bool):", mapValue);

    // Example 4: Getting a mapping slot
    const mapSlot = typedLayout.map.getSlot({
      keys: [1n, "0x0000000000000000000000000000000000000001" as Hex],
    });

    console.log("4. Storage slot for map[1]:", mapSlot);
    console.log("keys", typedLayout.map.keys);

    // Example 5: Reading a single item from an array
    const arrayItem = await typedLayout.array.getData({ index: 3 });
    console.log("5. array[3] (uint256):", arrayItem);

    // Example 6: Reading a range from an array
    const arrayRange = await typedLayout.array.getData({
      startIndex: 1,
      endIndex: 3,
    });
    console.log("6. array[1-3] (uint256[]):", arrayRange);

    // Example 7: Reading specific indexes from an array
    const arrayItems = await typedLayout.array.getData({
      indexes: [0, 2, 5],
    });
    console.log("7. array[0,2,5] (uint256[]):", arrayItems);

    // Example 8: Getting array length
    const arrayLength = await typedLayout.array.getLength();
    console.log("8. array.length:", arrayLength);

    // Example 9: Getting array item slot
    const arrayItemSlot = typedLayout.array.getSlot({ index: 2 });
    console.log("9. Storage slot for array[2]:", arrayItemSlot);

    // Example 10: Reading a struct 
    try {
      const structValue = await typedLayout.s.getData();
      console.log("10. Struct s:", structValue);
    } catch (error) {
      console.log("10. Struct s: Unable to read struct data");
    }

    // Example 11: Reading string and bytes
    const stringValue = await typedLayout.s1.getData();
    const bytesValue = await typedLayout.b1.getData();
    console.log("11. String s1:", stringValue);
    console.log("12. Bytes b1:", bytesValue);
  });
});
