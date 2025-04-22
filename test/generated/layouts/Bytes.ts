// Generated storage layout for Bytes
export default {
  "storage": [
    {
      "astId": 4,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Bytes.s.sol:Bytes",
      "label": "myString",
      "offset": 0,
      "slot": "0",
      "type": "t_string_storage"
    },
    {
      "astId": 6,
      "contract": "/Users/polarzero/code/projects/transaction-access-list/test/contracts/Bytes.s.sol:Bytes",
      "label": "myBytes",
      "offset": 0,
      "slot": "1",
      "type": "t_bytes_storage"
    }
  ],
  "types": {
    "t_bytes_storage": {
      "encoding": "bytes",
      "label": "bytes",
      "numberOfBytes": "32"
    },
    "t_string_storage": {
      "encoding": "bytes",
      "label": "string",
      "numberOfBytes": "32"
    }
  }
} as const;
