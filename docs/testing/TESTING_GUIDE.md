# Testing & Quality Assurance

This document outlines the testing infrastructure and practices used in the SQL Notebook plugin.

## Infrastructure

We use **[Vitest](https://vitest.dev/)** as our primary testing framework. It provides a modern, fast, and TypeScript-native environment for unit and integration tests.

### Configured Environment:
- **Engine**: Vitest 1.x+
- **Environment**: `jsdom` (to simulate browser APIs)
- **Mocks**: Specialized mock system for the Obsidian API (`src/__mocks__/obsidian.ts`)
- **Coverage**: `v8` for detailed line and branch coverage reports

## Testing Strategy

Since Obsidian plugins are heavily dependent on the Obsidian host application, we follow a two-tier strategy:

1.  **Isolated Pure Logic**: Critical logic (SQL transformation, sanitization, performance monitoring) is extracted into pure utility classes (e.g., `SQLTransformer.ts`) that can be tested 100% without Obsidian.
2.  **Mocked Core Service**: Core services like `DatabaseManager` and `QueryExecutor` are tested by mocking the Obsidian `app` and `plugin` objects.

## Running Tests

The following scripts are available in `package.json`:

- `npm test`: Runs all tests once and exits.
- `npm run test:watch`: Starts Vitest in watch mode (ideal for TDD).
- `npm run test:ui`: Opens a rich web interface to visualize test results and coverage.
- `npx vitest run --coverage`: Generates a code coverage report in the `coverage/` directory.

## Current Coverage Areas

- **SQL Transformation**: Verification of database prefixing, support for table-valued functions (`RANGE`, `JSON`), and `JOIN` logic.
- **Security**: Ensuring Safe Mode blocks structural changes and LIVE mode prevents write operations.
- **Database Management**: Robustness of reset, rename, duplicate, and snapshot operations.
- **FORM Mode**: Parsing of custom DSL for form generation and metadata accuracy.

## Writing New Tests

- Test files should be located in `__tests__` directories adjacent to the code they test.
- Follow the naming convention: `Name.test.ts`.
- Use `vi.mock('obsidian')` for any component that interacts with the Obsidian API.

---
*Last Updated: 2025-12-30*
