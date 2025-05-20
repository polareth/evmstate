# @polareth/evmstate

A TypeScript library for tracing, and visualizing EVM state changes with detailed human-readable labeling.

## Overview

The library traces all state changes after a transaction has been executed in a local VM, or by watching transactions in incoming blocks. It then labels them with semantic insights and a detailed diff of all the changes.

It can be seen as an alternative to using event logs for evm interfaces, as it captures and labels every state change with precise semantic information, including variable names, mapping keys, array indices, decoded values and path tracing.

Powered by [Tevm](https://github.com/evmts/tevm-monorepo) and [whatsabi](https://github.com/shazow/whatsabi).

## Features

- **Complete state change tracing**: Track the state of every account touched during the transaction
- **Human-readable labeling**: Retrieve the storage layout of each account if it's available for contracts, to label storage slots with variable names, decode values and provide a detailed path of access from the base slot to the final value
- **Intelligent key detection**: Extract and match mapping keys from transaction data
- **Type-aware decoding**: Convert raw storage values to appropriate JavaScript types; the state trace is fully typed if a storage layout is provided

## Installation

```bash
npm install @polareth/evmstate
# or
pnpm add @polareth/evmstate
# or
yarn add @polareth/evmstate
```

## Quickstart

```typescript
import { traceState } from "@polareth/evmstate";

// Trace a transaction
const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  from: "0xYourAddress",
  to: "0xContractAddress",
  data: "0xEncodedCalldata",
  value: 0n,
});

// Watch an account's state
const unsubscribe = await watchState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  address: "0xContractAddress",
  storageLayout: contractStorageLayout as const,
  abi: contractAbi,
  onStateChange: (stateChange) => {
    console.log(stateChange);
  },
  onError: (error) => {
    console.error(error);
  },
});
```

## Core functionality

### 1. `traceState` - Analyze transaction state

The `traceState` function is the primary way to analyze how a transaction affects state. It can be used in several ways:

#### Basic usage with RPC URL and transaction parameters

```typescript
import { traceState } from "@polareth/evmstate";

// Trace a simulated transaction
const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  from: "0xYourAddress",
  to: "0xContractAddress",
  data: "0xEncodedCalldata",
  value: 0n,
});
```

#### Using contract ABI for better readability

```typescript
import { traceState } from "@polareth/evmstate";

// Trace with typed contract call (similar to viem)
const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  from: "0xYourAddress",
  to: "0xContractAddress",
  abi: contractAbi,
  functionName: "transfer",
  args: ["0xRecipient", "1000000000000000000"], // address, amount
});
```

#### Tracing an existing transaction

```typescript
import { traceState } from "@polareth/evmstate";

// Trace an existing transaction by hash
const trace = await traceState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  txHash: "0xTransactionHash",
});
```

#### Using a custom Tevm client for more control

```typescript
import { createMemoryClient, http } from "tevm";
import { mainnet } from "tevm/common";

import { traceState } from "@polareth/evmstate";

// Initialize client
const client = createMemoryClient({
  common: mainnet,
  fork: {
    transport: http("https://1.rpc.thirdweb.com"),
    blockTag: "latest",
  },
});

// Trace with custom client
const trace = await traceState({
  client,
  from: "0xYourAddress",
  to: "0xContractAddress",
  data: "0xEncodedCalldata",
});
```

### 2. `Tracer` - Create reusable tracing instances

The `Tracer` class provides an object-oriented interface for reusing client instances and configuration:

```typescript
import { createMemoryClient, http } from "tevm";
import { mainnet } from "tevm/common";

import { Tracer } from "@polareth/evmstate";

// Initialize client
const client = createMemoryClient({
  common: mainnet,
  fork: {
    transport: http("https://1.rpc.thirdweb.com"),
    blockTag: "latest",
  },
});

// Create a reusable tracer
const tracer = new Tracer({ client });

// Trace multiple transactions with the same client
const trace1 = await tracer.traceState({
  from: "0xYourAddress",
  to: "0xContractAddress",
  data: "0xEncodedCalldata1",
});

const trace2 = await tracer.traceState({
  from: "0xYourAddress",
  to: "0xContractAddress",
  data: "0xEncodedCalldata2",
});
```

### 3. `watchState` - Monitor account state

The `watchState` function allows continuous monitoring of state access for a specific contract or EOA:

```typescript
import { watchState } from "@polareth/evmstate";

// Start watching state
const unsubscribe = await watchState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  address: "0xContractAddress",
  // Optional storage layout (improves labeling) - needs to be imported 'as const' similar to the ABI
  storageLayout: contractStorageLayout,
  // Optional ABI (improves decoding)
  abi: contractAbi,
  // Callback for state change/access
  onStateChange: (stateChange) => {
    console.log("State change detected:", stateChange);
    // Use the state
  },
  // Callback on error
  onError: (error) => {
    console.error("Watch error:", error);
  },
  // Optional polling interval (default: 1000ms)
  pollingInterval: 2000,
});

// Later, stop watching
unsubscribe();
```

## Understanding the output

The `traceState` and `watchState` functions return detailed information about state changes. The output follows this structure (`watchState` directly emits the object for the account address):

```typescript
{
  "0xContractAddress": {
    // Intrinsic state (balance, nonce, code)
    "balance": {
      "current": 1000000000000000000n, // Current value (bigint)
      "modified": true, // Whether it was modified
      "next": 2000000000000000000n // New value after the transaction
    },
    "nonce": {
      "current": 5,
      "modified": true,
      "next": 6
    },
    "code": { "current": "0x...", "modified": false },

    // Storage changes, labeled by variable name
    "storage": {
      // Primitive types
      "counter": {
        "kind": "primitive",
        "name": "counter",
        "type": "uint256",
        "trace": [
          {
            "current": { "hex": "0x05", "decoded": 5n },
            "modified": true,
            "next": { "hex": "0x06", "decoded": 6n },
            "path": [],
            "fullExpression": "counter",
            "slots": ["0x0000000000000000000000000000000000000000000000000000000000000000"]
          }
        ]
      },

      // Mappings with keys
      "balances": {
        "kind": "mapping",
        "name": "balances",
        "type": "mapping(address => uint256)",
        "trace": [
          {
            "current": { "hex": "0x2386f26fc10000", "decoded": 10000000000000000n },
            "modified": true,
            "next": { "hex": "0x2386f26fc10001", "decoded": 20000000000000000n },
            "path": [
              {
                "kind": "mapping_key",
                "key": "0x1234567890123456789012345678901234567890",
                "keyType": "address"
              }
            ],
            "fullExpression": "balances[0x1234567890123456789012345678901234567890]",
            "slots": ["0x8e9c0c9f9fb928592f2fb0a9314450706c27839d034893b88d8ed2f54cf1bd5e"]
          }
        ]
      },

      // Arrays with indices
      "numbers": {
        "kind": "dynamic_array",
        "name": "numbers",
        "type": "uint256[]",
        "trace": [
          {
            "current": { "hex": "0x03", "decoded": 3n },
            "modified": false,
            "path": [
              { "kind": "array_length", "name": "_length" }
            ],
            "fullExpression": "numbers._length",
            "slots": ["0x0000000000000000000000000000000000000000000000000000000000000003"]
          },
          {
            "current": { "hex": "0x64", "decoded": 100n },
            "modified": true,
            "next": { "hex": "0xc8", "decoded": 200n },
            "path": [
              { "kind": "array_index", "index": 2n }
            ],
            "fullExpression": "numbers[2]",
            "slots": ["0x5de13444fe158c7b5525d0d208535a5f84ca2f75ce5219b9c55fb55643beb57c"]
          }
        ]
      },

      // Structs with fields
      "user": {
        "kind": "struct",
        "name": "user",
        "type": "struct Contract.User",
        "trace": [
          {
            "current": { "hex": "0x00", "decoded": 0n },
            "modified": true,
            "next": { "hex": "0x01", "decoded": 1n },
            "path": [
              { "kind": "struct_field", "name": "id" }
            ],
            "fullExpression": "user.id",
            "slots": ["0x0000000000000000000000000000000000000000000000000000000000000004"]
          }
        ]
      }
    }
  }
}
```

### Key properties in the output

For each storage variable, the output includes:

- **`name`**: The human-readable variable name from the contract
- **`type?`**: The Solidity type of the variable
- **`kind?`**: The kind of storage variable (`"primitive"`, `"mapping"`, `"dynamic_array"`, `"static_array"`, `"struct"`, `"bytes"`, `"string"`)
- **`trace`**: An array of trace entries for this variable

Each trace entry contains:

- **`current?`**: The current value before the transaction (both hex and decoded)
- **`next?`**: The new value after the transaction (if modified)
- **`modified`**: Boolean indicating if the value was changed
- **`path`**: Array of path components (mapping keys, array indices, struct fields, length fields for bytes or arrays)
- **`fullExpression`**: A human-readable representation of the full variable access (e.g., `balances[0x1234][5]`)
- **`slots`**: The actual storage slots accessed

## Advanced usage

### Fully typed state changes

When providing a storage layout with `as const`, TypeScript will infer the correct types for all state changes:

```typescript
import { watchState } from "@polareth/evmstate";

import { erc20Layout } from "./layouts";

// Get fully typed state changes
const unsubscribe = await watchState({
  rpcUrl: "https://1.rpc.thirdweb.com",
  address: "0xContractAddress",
  storageLayout: erc20Layout as const,
  onStateChange: (stateChange) => {
    if (stateChange.storage.balances) {
      const balances = stateChange.storage.balances;
      // balances[`0x${string}`]
      const userBalance = balances.trace[0].fullExpression;
      // bigint | undefined
      const amount = balances.trace[0].next.decoded;
    }
  },
});
```

### Using a custom Tevm client

For more control over the environment, you can provide your own Tevm client:

```typescript
import { createMemoryClient, http } from "tevm";
import { mainnet } from "tevm/common";

import { watchState } from "@polareth/evmstate";

// Create custom client with specific configuration
const client = createMemoryClient({
  common: mainnet,
  fork: {
    transport: http("https://1.rpc.thirdweb.com"),
    blockTag: "latest",
  },
  // Add custom tevm options here
});

// Use the custom client
const unsubscribe = await watchState({
  client,
  address: "0xContractAddress",
  onStateChange: (stateChange) => {
    // Process state changes...
  },
});
```

## Supported contract patterns

The library has been extensively tested with diverse contract patterns:

- ✅ **Basic value types**: Integers, booleans, addresses, bytes
- ✅ **Storage packing**: Multiple variables packed in a single slot
- ✅ **Arrays**: Fixed and dynamic arrays with index access
- ✅ **Mappings**: Simple and nested mappings with various key types
- ✅ **Structs**: Simple and nested struct types
- ✅ **Dynamic types**: Bytes and string types
- ✅ **Proxies**: Transparent proxy patterns with implementation analysis
- ✅ **Native transfers**: ETH transfers between accounts
- ✅ **Contract creation**: Tracking new contract deployments

## How it works

The library combines several techniques to provide comprehensive state analysis:

1. **Transaction simulation**: Uses TEVM to simulate transactions in a local EVM environment
2. **Debug tracing**: Leverages `debug_traceTransaction` and `debug_traceBlock` for detailed state access
3. **Storage layout analysis**: Parses contract storage layouts to map slots to variable names
4. **Key detection**: Analyzes transaction input and execution traces to identify mapping keys and array indices
5. **Type-aware decoding**: Converts raw storage values to appropriate JavaScript types based on variable definitions

## License

MIT

## Development Setup (Building from Source)

If you want to contribute to `@polareth/evmstate` or build it from source, you'll need to set up your environment to compile both the TypeScript and the Zig code. The Zig code is compiled to WebAssembly (WASM) and called from TypeScript. Communication between TypeScript and Zig is handled using JSON strings (can be improved later with msgpack or flatbuffers).

### Prerequisites

1.  **Node.js and pnpm**:

    - Node.js (LTS version recommended).
    - [pnpm](https://pnpm.io/installation) (This project uses pnpm for package management). You can also use npm or yarn, but pnpm is preferred.

2.  **Zig Compiler**:
    - Install the Zig compiler (latest stable version recommended). Follow the official installation guide: [Zig Installation](https://ziglang.org/learn/getting-started/)
    - Ensure `zig` is available in your system's PATH.

### Build Steps

1.  **Clone the Repository**:

    ```bash
    git clone https://github.com/polareth/evmstate.git
    cd evmstate
    ```

2.  **Install Dependencies**:

    ```bash
    pnpm install
    ```

3.  **Compile Zig to WASM**:
    Compile the Zig source code (in `src/zig/`) into a WebAssembly module:

    ```bash
    pnpm build:zig
    ```

    This will output the WASM file to `dist/wasm/`.

4.  **Build the library**:
    Compile both the TypeScript and Zig code:
    ```bash
    pnpm build
    ```
    This command bundles the TypeScript code and ensures the Zig WASM module (expected in `dist/wasm/`) can be loaded, into the final distributable files in the `dist/` directory.

### Development Workflow

For active development, you can use watch scripts that automatically rebuild parts of the project when files change:

- **Watch Zig and TypeScript tests**:

  ```bash
  pnpm dev
  ```

  This will start parallel watchers for:

  - Zig source files (`.zig` files): Recompiles the WASM module and runs the tests.
  - TypeScript tests (`.test.ts` files): Runs the tests in watch mode.

- **Update zabi**:

  ```bash
  zig fetch --save git+https://github.com/Raiden1411/zabi.git#zig_version_0.14.0
  ```
