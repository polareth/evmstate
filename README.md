# @polareth/trace

A comprehensive library for EVM transaction analysis that provides detailed storage slot access tracking with semantic labeling.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [Usage](#usage)
  - [Basic usage with RPC URL](#basic-usage-with-rpc-url)
  - [Using contract ABI](#using-contract-abi)
  - [Tracing an existing transaction](#tracing-an-existing-transaction)
  - [Understanding the output](#understanding-the-output)
- [Advanced Usage](#advanced-usage)
  - [Using with Tevm](#using-with-tevm)
  - [Complex data structures](#complex-data-structures)
- [Details](#details)
  - [Contract patterns supported](#contract-patterns-supported)
  - [How it works](#how-it-works)
  - [Key architecture components](#key-architecture-components)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🔍 **Complete storage access tracing**: Identify all storage slots accessed during transaction execution with read/write classification
- 🏷️ **Semantic storage labeling**: Label storage slots with human-readable variable names, types, and mapping keys/array indices
- 🧠 **Intelligent key detection**: Automatically extract and match mapping keys and array indices from transaction data
- 🔢 **Type-aware value decoding**: Convert hex storage values to appropriate JavaScript types based on variable type definitions
- 📦 **Storage packing support**: Handle packed storage variables within a single 32-byte slot
- 🔄 **Proxy support**: Detect and resolve proxy contracts for complete implementation analysis
- 🔌 **Framework compatibility**: Works with popular EVM-compatible frameworks and providers
- 🧪 **Comprehensive test coverage**: Tested against diverse contract patterns and edge cases

## Installation

```bash
pnpm add @polareth/trace
# or
npm install @polareth/trace
# or
yarn add @polareth/trace
```

## Quickstart

```typescript
import { traceState } from "@polareth/trace";

// Trace a transaction with raw parameters
const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  from: "0x...", // sender address
  to: "0x...", // contract or recipient address (empty for contract creation)
  data: "0x...", // calldata
});

// Trace with a typed contract call (similar usage to viem)
const traceWithAbi = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  from: "0x...", // sender address
  to: "0x...", // contract address
  abi: erc20Abi, // ERC20 standard ABI
  functionName: "transfer",
  args: ["0x...", "100000000000000000000"], // address, amount
});

// Trace existing transaction by hash
const traceByHash = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  txHash: "0x...", // past transaction hash
});

console.log(trace);
// Output shows exactly which storage slots were accessed, with semantic labeling whenever possible
```

## Usage

The library offers multiple ways to trace transactions, from simple to advanced scenarios.

### Basic usage with RPC URL

The simplest way to use the library is by providing an RPC URL and transaction parameters:

```typescript
import { traceState } from "@polareth/trace";

const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  from: "0x...", // sender address
  to: "0x...", // contract or recipient address (empty for contract creation)
  data: "0x...", // calldata
});
```

### Using contract ABI

For a more developer-friendly approach, use a contract ABI instead of raw transaction data:

```typescript
import { traceState } from "@polareth/trace";

const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  from: "0x...", // sender address
  to: "0x...", // contract address
  abi: erc20Abi, // contract ABI
  functionName: "transfer",
  args: ["0x...", "1000000000000000000"], // recipient, amount
});
```

### Tracing an existing transaction

You can trace an already executed transaction by its hash:

```typescript
import { traceState } from "@polareth/trace";

const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  hash: "0x...", // past transaction hash
});
```

### Understanding the output

The trace results are structured to clearly show which storage slots were read and written:

```typescript
// Example output format:
{
  "0xAbcd...": {  // Contract address
    "reads": {  // Storage slots that were read
      "0x0000...": [
        {
          "label": "totalSupply",
          "type": "uint256",
          "current": {
            "hex": "0x0de0b6b3a7640000",
            "decoded": 1000000000000000000n
          }
        }
      ],
      "0x1234...": [
        {
          "label": "balances",
          "type": "mapping(address => uint256)",
          "current": {
            "hex": "0x056bc75e2d63100000",
            "decoded": 100000000000000000000n
          },
          "keys": ["0x1234..."]  // Detected mapping key (sender address)
        }
      ]
    },
    "writes": {  // Storage slots that were written
      "0x5678...": [
        {
          "label": "balances",
          "type": "mapping(address => uint256)",
          "current": {
            "hex": "0x00",
            "decoded": 0n
          },
          "next": {
            "hex": "0x056bc75e2d63100000",
            "decoded": 100000000000000000000n
          },
          "keys": ["0x5678..."]  // Detected mapping key (recipient address)
        }
      ]
    },
    "intrinsic": {  // Account state changes
      "balance": {
        "current": "0x1234...",
        "next": "0x1230..."
      },
      "nonce": {
        "current": "0x01",
        "next": "0x02"
      }
    }
  }
}
```

## Advanced usage

### Using with Tevm

For a more fine-grained control, you can provide your own Tevm client:

```typescript
import { createMemoryClient, http } from "tevm";
import { mainnet } from "tevm/common";
import { Tracer, traceState } from "@polareth/trace";

// Initialize client
const client = createMemoryClient({
  common: mainnet, // pass the common to avoid an unnecessary fetch for the chain config
  fork: {
    transport: http("https://1.rpc.thirdweb.com"),
    blockTag: "latest",
  },
});

// Option 1: Pass it directly to the traceState function
const trace = await traceState({
  client,
  from: "0x...",
  to: "0x...",
  data: "0x...",
});

// Option 2: Create a reusable tracer instance
const tracer = new Tracer({ client });
const trace2 = await tracer.traceState({
  from: "0x...",
  to: "0x...",
  data: "0x...",
});
```

### Complex data structures

TODO: review that and update when implemented

The library handles complex data structures with accurate labeling:

```typescript
// Example output for complex structures:

// Nested mappings
"0xabcd...": [
  {
    "label": "userTokenApprovals",
    "type": "mapping(address => mapping(uint256 => bool))",
    "current": { "hex": "0x01", "decoded": true },
    "keys": ["0x1234...", "42"]  // [userAddress, tokenId]
  }
]

// Arrays with indices
"0xefgh...": [
  {
    "label": "tokenOwners",
    "type": "address[]",
    "current": {
      "hex": "0x0000000000000000000000001234567890123456789012345678901234567890",
      "decoded": "0x1234567890123456789012345678901234567890"
    },
    "index": 5  // Array index
  }
]

// Packed storage variables
"0x0000...": [
  {
    "label": "smallValue1",
    "type": "uint8",
    "current": { "hex": "0x00", "decoded": 0 },
    "next": { "hex": "0x2a", "decoded": 42 }
  },
  {
    "label": "smallValue2",
    "type": "uint8",
    "current": { "hex": "0x00", "decoded": 0 },
    "next": { "hex": "0x7b", "decoded": 123 },
    "offset": 1
  },
  {
    "label": "flag",
    "type": "bool",
    "current": { "hex": "0x00", "decoded": false },
    "next": { "hex": "0x01", "decoded": true },
    "offset": 2
  }
]
```

## Details

### Contract patterns supported

The library is tested against a comprehensive set of contract patterns:

- ✅ **Basic Value Types**: Integers, booleans, addresses, bytes
- ✅ **Storage Packing**: Multiple variables packed in a single slot
- ✅ **Complex Data Structures**:
  - Mappings with various key/value types
  - Nested mappings (arbitrary depth)
  - Fixed and dynamic arrays
  - Structs and nested structs
- ✅ **Contract Interactions**: Calls between multiple contracts
- ✅ **Delegate Calls**: Storage access through delegate calls
- ✅ **Library Patterns**: Internal and external libraries
- ✅ **Proxy Patterns**: Transparent and minimal proxies
- ✅ **Assembly Storage Access**: Low-level SSTORE/SLOAD operations
- ✅ **Token Standards**: ERC-20, ERC-721, etc.

### How it works

The library combines transaction simulation with intelligent storage slot analysis:

1. **Transaction Simulation**: Uses TEVM to simulate the transaction and capture all storage access
2. **Trace Analysis**: Analyzes the EVM execution trace to extract potential mapping keys and array indices
3. **Type Detection**: Identifies variable types from contract metadata or ABI
4. **Slot Computation**: Applies Solidity's storage layout rules to match accessed slots with variable names
5. **Value Decoding**: Converts raw storage values to appropriate JavaScript types
6. **Result Labeling**: Produces a comprehensive report of all storage accesses with semantic labels

#### Key architecture components

- **Slot Engine**: Computes storage slots for various data structures
- **Trace Analyzer**: Extracts potential keys/indices from EVM execution traces
- **Storage Layout Parser**: Extracts contract storage information from metadata
- **Value Decoder**: Converts hex values to appropriate JavaScript types

## Development

- `pnpm test:unit` - Run unit tests
- `pnpm test:staging` - Run staging environment

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please make sure your code follows the existing style and passes all tests, including any new tests for verifying the new feature, if applicable.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
