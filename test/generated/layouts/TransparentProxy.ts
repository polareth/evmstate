// Generated storage layout for TransparentProxy
export default {
  "storage": [
    {
      "astId": 93,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/TransparentProxy.s.sol:TransparentProxy",
      "label": "_implementation",
      "offset": 0,
      "slot": "0",
      "type": "t_address"
    },
    {
      "astId": 95,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/TransparentProxy.s.sol:TransparentProxy",
      "label": "_admin",
      "offset": 0,
      "slot": "1",
      "type": "t_address"
    },
    {
      "astId": 99,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/TransparentProxy.s.sol:TransparentProxy",
      "label": "__gap",
      "offset": 0,
      "slot": "2",
      "type": "t_array(t_uint256)50_storage"
    }
  ],
  "types": {
    "t_address": {
      "encoding": "inplace",
      "label": "address",
      "numberOfBytes": "20"
    },
    "t_array(t_uint256)50_storage": {
      "base": "t_uint256",
      "encoding": "inplace",
      "label": "uint256[50]",
      "numberOfBytes": "1600"
    },
    "t_uint256": {
      "encoding": "inplace",
      "label": "uint256",
      "numberOfBytes": "32"
    }
  }
} as const;
