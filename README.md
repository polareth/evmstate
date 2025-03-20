# @polareth/trace

A comprehensive library for EVM transaction analysis that provides detailed storage slot access tracking with semantic labeling.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [With TEVM Client](#with-tevm-client)
  - [With Chain ID and RPC URL](#with-chain-id-and-rpc-url)
- [Advanced Usage](#advanced-usage)
  - [Working with Nested Mappings](#working-with-nested-mappings)
  - [Storage Type Decoding](#storage-type-decoding)
  - [Handling Packed Storage Variables](#handling-packed-storage-variables)
- [Contract Patterns Supported](#contract-patterns-supported)
- [How It Works](#how-it-works)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🔍 **Complete Storage Access Tracing**: Identify all storage slots accessed during transaction execution with read/write classification
- 🏷️ **Semantic Storage Labeling**: Label storage slots with human-readable variable names, types, and mapping keys/array indices
- 🧠 **Intelligent Key Detection**: Automatically extract and match mapping keys and array indices from transaction data
- 🔢 **Type-Aware Value Decoding**: Convert hex storage values to appropriate JavaScript types based on variable type definitions
- 📦 **Storage Packing Support**: Handle packed storage variables within a single 32-byte slot
- 🔄 **Proxy Support**: Detect and resolve proxy contracts for complete implementation analysis
- 🔌 **Framework Compatibility**: Works with popular EVM-compatible frameworks and providers
- 🧪 **Comprehensive Test Coverage**: Tested against diverse contract patterns and edge cases

## Installation

```bash
pnpm add @polareth/trace
# or
npm install @polareth/trace
# or
yarn add @polareth/trace
```

## Usage

### With TEVM Client

```typescript
import { createClient } from "tevm"; // Optional, you can use other clients too
import { traceStorageAccess } from "@polareth/trace";

// Initialize client
const client = createClient({
  /* your configuration */
});

// Trace a transaction
const trace = await traceStorageAccess({
  client,
  from: "0x1234...", // Sender address
  to: "0xAbcd...", // Contract address
  data: "0xa9059cbb...", // Transaction data (function call)
});

// Access the results
console.log(trace);
/*
{
  "0xAbcd...": {  // Contract address
    "reads": {  // Storage slots that were read
      "0x0000...": {
        "label": "totalSupply",
        "type": "uint256",
        "current": 1000000000000000000000000n,  // Decoded BigInt value 
      },
      "0x1234...": {
        "label": "balances",
        "type": "mapping(address => uint256)",
        "current": 500000000000000000000n,  // Decoded BigInt value
        "keys": ["0x5678..."]  // Detected mapping key (sender address)
      }
    },
    "writes": {  // Storage slots that were written
      "0x5678...": {
        "label": "balances",
        "type": "mapping(address => uint256)",
        "current": 500000000000000000000n,  // Value before (decoded)
        "next": 400000000000000000000n,     // Value after (decoded)
        "keys": ["0x9abc..."]  // Detected mapping key (recipient address)
      }
    },
    "intrinsic": {  // Intrinsic account state changes
      "balance": {
        "current": "0x1234...",
        "next": "0x1230..."
      },
      "nonce": {
        "current": 1,  // Decoded as number
        "next": 2      // Decoded as number
      }
    }
  },
  "0x1234...": {  // Sender address (account state changes)
    "intrinsic": {
      "balance": {
        "current": "0x1234...",
        "next": "0x1230..."  // Reduced by gas fees
      },
      "nonce": {
        "current": 1,  // Decoded as number 
        "next": 2      // Incremented by transaction
      }
    }
  }
}
*/
```

### With Chain ID and RPC URL

You can also use the library by providing a chain ID and RPC URL directly:

```typescript
import { traceStorageAccess } from "@polareth/trace";

// Trace a transaction
const trace = await traceStorageAccess({
  chainId: 1, // Ethereum Mainnet
  rpcUrl: "https://1.rpc.thirdweb.com",
  from: "0x1234...", // Sender address
  to: "0xAbcd...", // Contract address
  data: "0xa9059cbb...", // Transaction data (function call)
});

// For a specific block
const traceAtBlock = await traceStorageAccess({
  chainId: 1,
  rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
  from: "0x1234...",
  to: "0xAbcd...",
  data: "0xa9059cbb...",
  blockTag: 1800000n, // Trace at specific block height
});
```

## Advanced Usage

### Working with Nested Mappings

The library supports arbitrary nesting depth for mappings with the flexible keys array:

```typescript
// For a mapping like: mapping(address => mapping(uint256 => bool)) userTokenApprovals
const trace = await traceStorageAccess({
  /* config */
});

// The trace might include a slot like:
/*
{
  "0xabcd...": {
    "label": "userTokenApprovals",
    "type": "mapping(address => mapping(uint256 => bool))",
    "keys": ["0x1234...", "42"],  // [userAddress, tokenId]
    "current": false,  // Decoded boolean value
    "next": true       // Decoded boolean value
  }
}
*/
```

### Storage Type Decoding

The library automatically decodes storage values based on their Solidity types:

```typescript
// For various Solidity types:
const trace = await traceStorageAccess({
  /* config */
});

// The trace includes properly decoded values:
/*
{
  // For uint8, uint16, etc. that fit in JavaScript number
  "0x123...": { 
    "label": "smallValue",
    "type": "uint8", 
    "current": 41,  // JavaScript number
    "next": 42      // JavaScript number
  },
  
  // For uint256 or large numbers
  "0x456...": { 
    "label": "largeValue",
    "type": "uint256", 
    "current": 1234567890123456789012345678901234567890n,  // BigInt
    "next": 1234567890123456789012345678901234567891n      // BigInt
  },
  
  // For boolean values
  "0x789...": { 
    "label": "flagValue",
    "type": "bool", 
    "current": false,  // JavaScript boolean
    "next": true       // JavaScript boolean
  },
  
  // For address values
  "0xabc...": { 
    "label": "addressValue",
    "type": "address", 
    "current": "0x1234567890123456789012345678901234567890",  // Normalized address string
    "next": "0x2345678901234567890123456789012345678901"      // Normalized address string
  }
}
*/
```

### Handling Packed Storage Variables

Solidity packs multiple small variables into a single storage slot. The library handles these correctly:

```typescript
// For packed variables:
// uint8 a; uint8 b; bool c; address d;  // All in a single slot

const trace = await traceStorageAccess({
  /* config */
});

// The trace will show the packed slot:
/*
{
  "0x0": {
    "label": "(packed storage)",
    "type": "(packed uint8,uint8,bool,address)",
    "current": "0x0000000000000000000000001234567890abcdef1234567890abcdef12345601010a",
    "next": "0x0000000000000000000000001234567890abcdef1234567890abcdef12345601012a"
  }
}
*/
```

## Contract Patterns Supported

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

## How It Works

The library combines transaction simulation with intelligent storage slot analysis:

1. **Transaction Simulation**: Uses TEVM to simulate the transaction and capture all storage access
2. **Trace Analysis**: Analyzes the EVM execution trace to extract potential mapping keys and array indices
3. **Type Detection**: Identifies variable types from contract metadata or ABI
4. **Slot Computation**: Applies Solidity's storage layout rules to match accessed slots with variable names
5. **Value Decoding**: Converts raw storage values to appropriate JavaScript types
6. **Result Labeling**: Produces a comprehensive report of all storage accesses with semantic labels

### Key Architecture Components

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

Please make sure your code follows the existing style and passes all tests.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
