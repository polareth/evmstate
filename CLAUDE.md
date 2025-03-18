# CLAUDE.md - Project Guidelines

## Commands

- Build & Test: `pnpm test` - Runs all vitest tests
- Run single test: `pnpm test -- -t 'test name'` or `pnpm test test/counter.test.ts`
- Check types: `tsc --noEmit`

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
- **Solidity**: Use latest compiler (^0.8.28), use private state vars
- **Testing**: Use vitest, organize in describe/it blocks, clear assertions
