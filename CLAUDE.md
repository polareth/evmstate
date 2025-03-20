# CLAUDE.md - Transaction Access List Project

## Description

This library generates and analyzes EVM transaction access lists, helping identify and label storage slots
accessed during transaction execution. It's particularly strong at detecting mapping keys and array indices
from transaction data.

## Commands

- Build & Test: `pnpm test` - Runs all vitest tests
- Run single test: `pnpm test -- -t 'test name'` or `pnpm test test/basic.test.ts`
- Check types: `tsc --noEmit`
- Update dependencies: `pnpm update`

## Architecture

- **Core Concepts**:

  - Uses TEVM to simulate transactions and capture storage access
  - Analyzes contract storage layout to map slots to variable names
  - Extracts transaction parameters to identify mapping keys and array indices
  - Labels storage slot access with full context (variable.key format)

- **Key Files**:
  - `src/lib/trace.ts` - Main transaction simulation logic
  - `src/lib/storage-layout.ts` - Storage slot labeling and key detection
  - `src/lib/access-list.ts` - Access list handling utilities
  - `src/lib/types.ts` - Type definitions

## Code Style

- **Imports**: Use relative paths for imports (e.g., '../src/lib/accessList')
- **Formatting**: Uses Prettier with sort-imports plugin
- **Types**: Strong typing with TypeScript, avoid `any`
- **Naming**:
  - Variables: camelCase
  - Constants: camelCase
  - Functions: camelCase
  - Classes/Contracts: PascalCase
- **Organization**: Group code with comment blocks: `/* ----- CONSTANTS ----- */`
- **Error Handling**: Use try/catch with specific error messages
- **Solidity**: Use latest compiler (^0.8.23), use private state vars
- **Testing**: Use vitest, organize in describe/it blocks, clear assertions

## Storage Layout Understanding

- **Solidity Storage Layout**:

  - Simple variables are stored at fixed slots (0, 1, etc.)
  - Mappings compute slots using keccak256(key, baseSlot)
  - Arrays compute slots using keccak256(baseSlot) + index
  - Structs are stored sequentially from their base slot

- **Key Recovery Algorithm**:
  - Extract potential keys from transaction data
  - For each mapping/array and potential key, compute the slot
  - Compare with observed slots to identify matches
