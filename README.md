# Transaction Access List

A comprehensive library for generating and analyzing EVM transaction access lists. This library helps identify and label storage slots accessed during transaction execution across various smart contract patterns.

## Features

- 🔍 Identify all storage slots accessed during transaction execution
- 🏗️ Support for complex contract interactions and patterns
- 📊 Utilities to analyze and visualize access patterns
- 🔄 Compatibility with different EVM implementations
- 📋 Detailed labeling of accessed storage slots
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
import { 
  analyzeTransactionStorageAccess, 
  LabeledSlot, 
  StorageLayout 
} from "transaction-access-list";

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
  contract.write.someFunction()
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
import { analyzeContract, analyzeAndLabelSlots } from "transaction-access-list";

// Analyze the contract bytecode
const bytecode = await provider.getCode(contractAddress);
const analysis = await analyzeContract(contractAddress, bytecode, provider);

console.log('Contract ABI:', analysis.abi);
console.log('Function selectors:', analysis.selectors);
console.log('Is proxy:', analysis.isProxy);

if (analysis.isProxy && analysis.implementationAddress) {
  console.log('Implementation address:', analysis.implementationAddress);
}

// Enhance slot labels with contract analysis
const { labeledSlots } = await analyzeAndLabelSlots(
  contractAddress,
  bytecode,
  provider,
  slots
);
```

## Advanced Features

### Storage Slot Calculation

Calculate storage slots for mappings and arrays:

```typescript
import { calculateMappingSlot, calculateArraySlot } from "transaction-access-list";

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
   - Classify slots as read-only or write access
   - Track storage value changes
   - Resolve proxy implementations for accurate analysis

This allows developers to understand the storage footprint of their transactions, optimize gas usage, identify potential storage collisions, and understand complex contract interactions.

## Development

- `pnpm test` - Run all tests
- `npx tsc --noEmit` - Type check the codebase