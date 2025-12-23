# Performance Improvements

## 1. Web Worker Offloading
- **Goal**: Prevent UI freezing during heavy queries.
- **Details**: Move the `alasql` execution to a Web Worker. This ensures that long-running `INSERT` scripts or complex `JOIN`s do not block the Obsidian main thread.

## 2. Lazy Loading Results
- **Goal**: Speed up initial render.
- **Details**: Render only the first 50 rows of a result set immediately. Render the rest on scroll or demand.

## 3. IndexedDB Persistence
- **Goal**: Handle larger datasets than `data.json` allows.
- **Details**: Instead of saving the entire DB to a single JSON file, use the browser's IndexedDB (via AlaSQL's local storage or a custom adapter) for better performance with 10k+ rows.
