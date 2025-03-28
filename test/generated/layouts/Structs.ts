// Generated storage layout for Structs
export default {
  "storage": [
    {
      "astId": 33,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
      "label": "precedingValue",
      "offset": 0,
      "slot": "0",
      "type": "t_uint8"
    },
    {
      "astId": 36,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
      "label": "packedStruct",
      "offset": 0,
      "slot": "1",
      "type": "t_struct(PackedStruct)15_storage"
    },
    {
      "astId": 39,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
      "label": "basicStruct",
      "offset": 0,
      "slot": "2",
      "type": "t_struct(BasicStruct)6_storage"
    },
    {
      "astId": 42,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
      "label": "nestedStruct",
      "offset": 0,
      "slot": "4",
      "type": "t_struct(NestedStruct)21_storage"
    },
    {
      "astId": 45,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
      "label": "dynamicStruct",
      "offset": 0,
      "slot": "7",
      "type": "t_struct(DynamicStruct)31_storage"
    }
  ],
  "types": {
    "t_array(t_uint256)dyn_storage": {
      "base": "t_uint256",
      "encoding": "dynamic_array",
      "label": "uint256[]",
      "numberOfBytes": "32"
    },
    "t_bool": {
      "encoding": "inplace",
      "label": "bool",
      "numberOfBytes": "1"
    },
    "t_mapping(t_uint256,t_bool)": {
      "encoding": "mapping",
      "key": "t_uint256",
      "label": "mapping(uint256 => bool)",
      "numberOfBytes": "32",
      "value": "t_bool"
    },
    "t_string_storage": {
      "encoding": "bytes",
      "label": "string",
      "numberOfBytes": "32"
    },
    "t_struct(BasicStruct)6_storage": {
      "encoding": "inplace",
      "label": "struct Structs.BasicStruct",
      "members": [
        {
          "astId": 3,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "id",
          "offset": 0,
          "slot": "0",
          "type": "t_uint256"
        },
        {
          "astId": 5,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "name",
          "offset": 0,
          "slot": "1",
          "type": "t_string_storage"
        }
      ],
      "numberOfBytes": "64"
    },
    "t_struct(DynamicStruct)31_storage": {
      "encoding": "inplace",
      "label": "struct Structs.DynamicStruct",
      "members": [
        {
          "astId": 23,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "id",
          "offset": 0,
          "slot": "0",
          "type": "t_uint256"
        },
        {
          "astId": 26,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "numbers",
          "offset": 0,
          "slot": "1",
          "type": "t_array(t_uint256)dyn_storage"
        },
        {
          "astId": 30,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "flags",
          "offset": 0,
          "slot": "2",
          "type": "t_mapping(t_uint256,t_bool)"
        }
      ],
      "numberOfBytes": "96"
    },
    "t_struct(NestedStruct)21_storage": {
      "encoding": "inplace",
      "label": "struct Structs.NestedStruct",
      "members": [
        {
          "astId": 17,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "id",
          "offset": 0,
          "slot": "0",
          "type": "t_uint256"
        },
        {
          "astId": 20,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "basic",
          "offset": 0,
          "slot": "1",
          "type": "t_struct(BasicStruct)6_storage"
        }
      ],
      "numberOfBytes": "96"
    },
    "t_struct(PackedStruct)15_storage": {
      "encoding": "inplace",
      "label": "struct Structs.PackedStruct",
      "members": [
        {
          "astId": 8,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "a",
          "offset": 0,
          "slot": "0",
          "type": "t_uint8"
        },
        {
          "astId": 10,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "b",
          "offset": 1,
          "slot": "0",
          "type": "t_uint16"
        },
        {
          "astId": 12,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "c",
          "offset": 3,
          "slot": "0",
          "type": "t_uint32"
        },
        {
          "astId": 14,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/data-structures/Structs.s.sol:Structs",
          "label": "d",
          "offset": 7,
          "slot": "0",
          "type": "t_bool"
        }
      ],
      "numberOfBytes": "32"
    },
    "t_uint16": {
      "encoding": "inplace",
      "label": "uint16",
      "numberOfBytes": "2"
    },
    "t_uint256": {
      "encoding": "inplace",
      "label": "uint256",
      "numberOfBytes": "32"
    },
    "t_uint32": {
      "encoding": "inplace",
      "label": "uint32",
      "numberOfBytes": "4"
    },
    "t_uint8": {
      "encoding": "inplace",
      "label": "uint8",
      "numberOfBytes": "1"
    }
  }
} as const;
