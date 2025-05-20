// Generated storage layout for CounterImplV2
export default {
  "storage": [
    {
      "astId": 32,
      "contract": "/Users/polarzero/code/projects/evmstate/test/contracts/TransparentProxy.s.sol:CounterImplV2",
      "label": "_count",
      "offset": 0,
      "slot": "0",
      "type": "t_uint256"
    },
    {
      "astId": 34,
      "contract": "/Users/polarzero/code/projects/evmstate/test/contracts/TransparentProxy.s.sol:CounterImplV2",
      "label": "_paused",
      "offset": 0,
      "slot": "1",
      "type": "t_bool"
    }
  ],
  "types": {
    "t_bool": {
      "encoding": "inplace",
      "label": "bool",
      "numberOfBytes": "1"
    },
    "t_uint256": {
      "encoding": "inplace",
      "label": "uint256",
      "numberOfBytes": "32"
    }
  }
} as const;
