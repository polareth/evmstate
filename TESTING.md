# Testing with Storage Layout Mocks

This document explains how the mock system for contract storage layouts works in this project.

## Overview

The project includes a mock system for the `getContracts` function in `src/lib/storage-layout.ts`. This mock allows tests to run without relying on external APIs like Sourcify or Etherscan, which can be unreliable or rate-limited during testing.

## How It Works

1. The mock is defined in `test/setup.ts` and automatically enabled for all tests except those run with the `test:staging` command.

2. The mock intercepts calls to `getContracts` and returns contract information directly from our local test contracts.

3. It maps addresses to contract sources based on a predefined mapping in the `findContractByAddress` function.

## Adding Contracts to the Mock

To add a new contract to the mock system:

1. Add an entry to the `contractMap` object in the `findContractByAddress` function in `test/setup.ts`:

```typescript
const contractMap: Record<string, { name: string; contractType: string }> = {
  // Existing entries...
  "0xYOUR_NEW_ADDRESS": { 
    name: "YourContractName", 
    contractType: "path/to/YourContract.s.sol" 
  },
};
```

2. Add an entry to the `contractPaths` object in the `getContractSources` function:

```typescript
const contractPaths: Record<string, string> = {
  // Existing entries...
  "YourContractName": "path/to/YourContract.s.sol",
};
```

## Testing Commands

The project provides different test commands for different scenarios:

- `pnpm test`: Runs all tests with mocks enabled
- `pnpm test:mocked`: Runs only the mocked test examples
- `pnpm test:staging`: Runs only the staging tests with real API calls (no mocks)

## Extending the Mock

To enhance the mock functionality:

1. You can implement a more sophisticated contract matching system in `findContractByAddress`
2. You can add support for compiling contracts on-the-fly using tevm's compiler
3. You can add more detailed metadata about the contracts

## Debugging

If you encounter issues with the mock:

1. Check that the contract file paths are correct
2. Verify that the contract addresses match what's expected in your tests
3. Look for error messages in the console about missing contract files

## Example

The file `test/mocked-tests.ts` demonstrates how to use the mocked contract system. It shows how to set up a test that uses the mocked `getContracts` function to get labeled storage slots without external API calls.