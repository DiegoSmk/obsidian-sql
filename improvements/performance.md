# Performance Improvements

## 1. Lazy Loading Results (Implemented)
- **Goal**: Speed up initial render.
- **Details**: `main.ts` now paginates results 50 rows at a time. Requires no further action.

## 2. Web Worker Offloading (Researched)
- **Goal**: Prevent UI freezing during heavy queries.
- **Analysis**:
    - AlaSQL supports workers, but bundling a secondary entry point in Obsidian is complex due to plugin architecture.
    - **Strategy**: Creating a `worker.ts` and configuring `esbuild` to output a separate `worker.js`.
    - **Constraint**: Main thread communication must be asynchronous (which `alasql.promise` already is).

## 3. IndexedDB Persistence (Researched)
- **Goal**: Handle larger datasets than `data.json` allows.
- **Analysis**:
    - **Pros**: Can handle 500MB+ depending on browser limits. Fast structured access.
    - **Cons**: Does **not** sync with Obsidian Sync. Data is local to the device.
    - **Recommendation**: Only implement if users specifically request "Local-Only High Performance Mode". `data.json` is sufficient for <10MB text data.
