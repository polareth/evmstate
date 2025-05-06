// [!region mappings]
export const layout = {
  storage: [
    {
      astId: 5,
      contract: "Mappings.s.sol:Mappings",
      label: "balances",
      offset: 0,
      slot: "0",
      type: "t_mapping(t_address,t_uint256)",
    },
    {
      astId: 11,
      contract: "Mappings.s.sol:Mappings",
      label: "allowances",
      offset: 0,
      slot: "1",
      type: "t_mapping(t_address,t_mapping(t_address,t_uint256))",
    },
    {
      astId: 33,
      contract: "Mappings.s.sol:Mappings",
      label: "userInfo",
      offset: 0,
      slot: "3",
      type: "t_mapping(t_address,t_struct(UserInfo)28_storage)",
    },
    {
      astId: 38,
      contract: "Mappings.s.sol:Mappings",
      label: "purchases",
      offset: 0,
      slot: "4",
      type: "t_mapping(t_uint256,t_array(t_uint256)dyn_storage)",
    },
  ],
  types: {
    t_address: {
      encoding: "inplace",
      label: "address",
      numberOfBytes: "20",
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
    "t_mapping(t_address,t_mapping(t_address,t_uint256))": {
      encoding: "mapping",
      key: "t_address",
      label: "mapping(address => mapping(address => uint256))",
      numberOfBytes: "32",
      value: "t_mapping(t_address,t_uint256)",
    },
    "t_mapping(t_address,t_struct(UserInfo)28_storage)": {
      encoding: "mapping",
      key: "t_address",
      label: "mapping(address => struct Mappings.UserInfo)",
      numberOfBytes: "32",
      value: "t_struct(UserInfo)28_storage",
    },
    "t_mapping(t_address,t_uint256)": {
      encoding: "mapping",
      key: "t_address",
      label: "mapping(address => uint256)",
      numberOfBytes: "32",
      value: "t_uint256",
    },
    "t_mapping(t_uint256,t_array(t_uint256)dyn_storage)": {
      encoding: "mapping",
      key: "t_uint256",
      label: "mapping(uint256 => uint256[])",
      numberOfBytes: "32",
      value: "t_array(t_uint256)dyn_storage",
    },
    "t_struct(UserInfo)28_storage": {
      encoding: "inplace",
      label: "struct Mappings.UserInfo",
      members: [
        {
          astId: 23,
          contract: "Mappings.s.sol:Mappings",
          label: "balance",
          offset: 0,
          slot: "0",
          type: "t_uint256",
        },
        {
          astId: 25,
          contract: "Mappings.s.sol:Mappings",
          label: "lastUpdate",
          offset: 0,
          slot: "1",
          type: "t_uint256",
        },
        {
          astId: 27,
          contract: "Mappings.s.sol:Mappings",
          label: "isActive",
          offset: 0,
          slot: "2",
          type: "t_bool",
        },
      ],
      numberOfBytes: "96",
    },
    t_uint256: {
      encoding: "inplace",
      label: "uint256",
      numberOfBytes: "32",
    },
  },
} as const;
// [!endregion mappings]

// [!region erc20]
export const erc20Layout = {
  storage: [
    {
      astId: 1,
      contract: "ERC20.s.sol:ERC20",
      label: "totalSupply",
      offset: 0,
      slot: "0",
      type: "t_uint256"
    },
    {
      astId: 2,
      contract: "ERC20.s.sol:ERC20",
      label: "balances",
      offset: 0,
      slot: "1",
      type: "t_mapping(t_address,t_uint256)"
    }
  ],
  types: {
    t_uint256: {
      encoding: "inplace",
      label: "uint256",
      numberOfBytes: "32"
    },
    t_address: {
      encoding: "inplace",
      label: "address",
      numberOfBytes: "20"
    },
    "t_mapping(t_address,t_uint256)": {
      encoding: "mapping",
      key: "t_address",
      label: "mapping(address => uint256)",
      numberOfBytes: "32",
      value: "t_uint256"
    }
  }
} as const;
// [!endregion erc20]