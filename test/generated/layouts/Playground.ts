// Generated storage layout for Playground
export default {
  "storage": [
    {
      "astId": 4,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "counter",
      "offset": 0,
      "slot": "0",
      "type": "t_uint256"
    },
    {
      "astId": 6,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "isActive",
      "offset": 0,
      "slot": "1",
      "type": "t_bool"
    },
    {
      "astId": 8,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "owner",
      "offset": 1,
      "slot": "1",
      "type": "t_address"
    },
    {
      "astId": 10,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "smallCounter",
      "offset": 21,
      "slot": "1",
      "type": "t_uint8"
    },
    {
      "astId": 12,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "mediumCounter",
      "offset": 22,
      "slot": "1",
      "type": "t_uint16"
    },
    {
      "astId": 14,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "largeCounter",
      "offset": 24,
      "slot": "1",
      "type": "t_uint32"
    },
    {
      "astId": 16,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "isLocked",
      "offset": 28,
      "slot": "1",
      "type": "t_bool"
    },
    {
      "astId": 18,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "operator",
      "offset": 0,
      "slot": "2",
      "type": "t_address"
    },
    {
      "astId": 20,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "name",
      "offset": 0,
      "slot": "3",
      "type": "t_string_storage"
    },
    {
      "astId": 22,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "data",
      "offset": 0,
      "slot": "4",
      "type": "t_bytes_storage"
    },
    {
      "astId": 26,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "balances",
      "offset": 0,
      "slot": "5",
      "type": "t_mapping(t_address,t_uint256)"
    },
    {
      "astId": 32,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "allowances",
      "offset": 0,
      "slot": "6",
      "type": "t_mapping(t_address,t_mapping(t_address,t_uint256))"
    },
    {
      "astId": 35,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "values",
      "offset": 0,
      "slot": "7",
      "type": "t_array(t_uint256)dyn_storage"
    },
    {
      "astId": 39,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "fixedValues",
      "offset": 0,
      "slot": "8",
      "type": "t_array(t_uint256)3_storage"
    },
    {
      "astId": 49,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "admin",
      "offset": 0,
      "slot": "11",
      "type": "t_struct(User)46_storage"
    },
    {
      "astId": 54,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "users",
      "offset": 0,
      "slot": "14",
      "type": "t_mapping(t_address,t_struct(User)46_storage)"
    },
    {
      "astId": 58,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "userList",
      "offset": 0,
      "slot": "15",
      "type": "t_array(t_struct(User)46_storage)dyn_storage"
    },
    {
      "astId": 63,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
      "label": "userTransactions",
      "offset": 0,
      "slot": "16",
      "type": "t_mapping(t_uint256,t_array(t_uint256)dyn_storage)"
    }
  ],
  "types": {
    "t_address": {
      "encoding": "inplace",
      "label": "address",
      "numberOfBytes": "20"
    },
    "t_array(t_struct(User)46_storage)dyn_storage": {
      "base": "t_struct(User)46_storage",
      "encoding": "dynamic_array",
      "label": "struct Playground.User[]",
      "numberOfBytes": "32"
    },
    "t_array(t_uint256)3_storage": {
      "base": "t_uint256",
      "encoding": "inplace",
      "label": "uint256[3]",
      "numberOfBytes": "96"
    },
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
    "t_bytes_storage": {
      "encoding": "bytes",
      "label": "bytes",
      "numberOfBytes": "32"
    },
    "t_mapping(t_address,t_mapping(t_address,t_uint256))": {
      "encoding": "mapping",
      "key": "t_address",
      "label": "mapping(address => mapping(address => uint256))",
      "numberOfBytes": "32",
      "value": "t_mapping(t_address,t_uint256)"
    },
    "t_mapping(t_address,t_struct(User)46_storage)": {
      "encoding": "mapping",
      "key": "t_address",
      "label": "mapping(address => struct Playground.User)",
      "numberOfBytes": "32",
      "value": "t_struct(User)46_storage"
    },
    "t_mapping(t_address,t_uint256)": {
      "encoding": "mapping",
      "key": "t_address",
      "label": "mapping(address => uint256)",
      "numberOfBytes": "32",
      "value": "t_uint256"
    },
    "t_mapping(t_uint256,t_array(t_uint256)dyn_storage)": {
      "encoding": "mapping",
      "key": "t_uint256",
      "label": "mapping(uint256 => uint256[])",
      "numberOfBytes": "32",
      "value": "t_array(t_uint256)dyn_storage"
    },
    "t_string_storage": {
      "encoding": "bytes",
      "label": "string",
      "numberOfBytes": "32"
    },
    "t_struct(User)46_storage": {
      "encoding": "inplace",
      "label": "struct Playground.User",
      "members": [
        {
          "astId": 41,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
          "label": "id",
          "offset": 0,
          "slot": "0",
          "type": "t_uint256"
        },
        {
          "astId": 43,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
          "label": "username",
          "offset": 0,
          "slot": "1",
          "type": "t_string_storage"
        },
        {
          "astId": 45,
          "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Playground.s.sol:Playground",
          "label": "active",
          "offset": 0,
          "slot": "2",
          "type": "t_bool"
        }
      ],
      "numberOfBytes": "96"
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
