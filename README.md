# trace

A comprehensive library for generating and analyzing EVM transaction access lists. This library helps identify and label storage slots accessed during transaction execution across various smart contract patterns.

## Features

- 🔍 Identify all storage slots accessed during transaction execution
- 🏗️ Support for complex contract interactions and patterns
- 📊 Utilities to analyze and visualize access patterns
- 🔄 Compatibility with different EVM implementations
- 📋 Detailed labeling of accessed storage slots with key/index identification
- 🧠 Smart mapping key and array index detection from transaction data
- 🔬 WhatsABI integration for improved contract analysis
- 🧩 Proxy contract detection and implementation resolution

## Test Contract Patterns

The library includes test contracts for the following patterns:

### Implemented

- ✅ Basic Storage Operations (Counter, MultiSlot)
- ✅ Storage Packing (multiple variables in a single slot)
- ✅ Complex Data Structures (Mappings, Arrays, Structs)
- ✅ Cross-Contract Interactions (ContractA → B → C chain)
- ✅ Delegate Calls (DelegateBase, DelegateLogic)
- ✅ Library Patterns (Internal and External Libraries)
- ✅ Proxy Patterns (TransparentProxy with implementation upgrades)
- ✅ Assembly-level Storage Access
- ✅ ERC-20 Token Standard

## Usage

### Basic Access List Analysis

```typescript
import { analyzeTransactionStorageAccess, LabeledSlot, StorageLayout } from "transaction-access-list";

// Define contract storage layout
const STORAGE_LAYOUT: StorageLayout = {
  0: { name: "count", type: "uint256" },
  1: { name: "owner", type: "address" },
  2: { name: "balances", type: "mapping(address => uint256)" },
};

// Analyze transaction storage access
const result = await analyzeTransactionStorageAccess(
  provider,
  contract.address,
  "MyContract",
  STORAGE_LAYOUT,
  contract.write.someFunction(),
);

// Access analyzed results
const { slots, labeledSlots, writeSlots, readOnlySlots } = result;

// Display accessed slots with labels
console.log("All accessed slots:", labeledSlots);
console.log("Write slots:", writeSlots);
console.log("Read-only slots:", readOnlySlots);
```

### WhatsABI Integration

Enhance slot labels using WhatsABI contract analysis:

```typescript
import { analyzeAndLabelSlots, analyzeContract } from "transaction-access-list";

// Analyze the contract bytecode
const bytecode = await provider.getCode(contractAddress);
const analysis = await analyzeContract(contractAddress, bytecode, provider);

console.log("Contract ABI:", analysis.abi);
console.log("Function selectors:", analysis.selectors);
console.log("Is proxy:", analysis.isProxy);

if (analysis.isProxy && analysis.implementationAddress) {
  console.log("Implementation address:", analysis.implementationAddress);
}

// Enhance slot labels with contract analysis
const { labeledSlots } = await analyzeAndLabelSlots(contractAddress, bytecode, provider, slots);
```

## Advanced Features

### Storage Slot Calculation

Calculate storage slots for mappings and arrays:

```typescript
import { calculateArraySlot, calculateMappingSlot } from "transaction-access-list";

// Calculate slot for mapping[key]
const mappingSlot = 2n; // The slot where the mapping itself is stored
const key = "0x1234..."; // The mapping key
const slot = calculateMappingSlot(mappingSlot, key);

// Calculate slot for array[index]
const arraySlot = 3n; // The slot where the array length is stored
const index = 5;
const elementSlot = calculateArraySlot(arraySlot, index);
```

### Read vs Write Analysis

Distinguish between slots that are read versus written:

```typescript
import { classifySlotAccess } from "transaction-access-list";

const { writeSlots, readOnlySlots } = classifySlotAccess(slots);
```

## How It Works

The library uses a combination of TEVM's transaction simulation and WhatsABI's contract analysis:

1. TEVM provides the access list of storage slots touched during transaction simulation
2. WhatsABI analyzes the contract bytecode to determine its ABI and detect proxies
3. The library processes these access lists to:
   - Identify all accessed storage slots
   - Label slots based on contract storage layout and ABI
   - Extract transaction parameters and use them to identify mapping keys and array indices
   - Compute possible slot values using extracted keys/indices and match against actual accessed slots
   - Classify slots as read-only or write access
   - Track storage value changes
   - Resolve proxy implementations for accurate analysis

### EVM Trace-Based Storage Slot Labeling

A key innovation in this library is its ability to identify which mapping keys or array indices were accessed during a transaction:

1. The EVM execution trace is captured during transaction simulation (all opcodes and stack values)
2. Stack values, transaction parameters, and other trace data are extracted as potential key/index candidates
3. For each accessed storage slot that belongs to a mapping or array, the library:
   - Tries each extracted value as a potential key/index
   - Computes the corresponding storage slot using Solidity's storage layout rules
   - Checks if the computed slot matches any actually accessed slot
   - If a match is found, it provides a fully labeled storage access like `balances[0x1234...]` instead of just `balances[unknown key]`

This approach has significant advantages over previous methods:
- Works even when ABI decoding isn't available or reliable
- Can identify complex nested mapping keys and dynamic array indices
- Utilizes the actual values used by the EVM during execution
- Handles storage patterns across different Solidity versions consistently

This allows developers to understand the storage footprint of their transactions with much greater precision, optimize gas usage, identify potential storage collisions, and understand complex contract interactions.

## Development

- `pnpm test` - Run all tests
- `npx tsc --noEmit` - Type check the codebase
