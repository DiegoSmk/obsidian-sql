# Bug Fixes & Stability

## 1. Syntax Sanitization Edge Cases
- **Issue**: Complex `CREATE TABLE` statements with specific collations or engine options might still be missed by `cleanSQL`.
- **Fix**: Replace regex with a proper parser or a more robust token-based stripper for unsupported clauses.

## 2. "Database already exists" on Reload
- **Issue**: Occasionally, if the plugin reloads rapidly, AlaSQL might throw an error trying to init `empresa`.
- **Fix**: Ensure strict check `if (alasql.databases.empresa) return;` before initialization logic.

## 3. Large Integers
- **Issue**: JavaScript numbers lose precision for very large integers (BIGINT).
- **Fix**: Integrate a BigInt library or ensure AlaSQL is configured to handle BigInts correctly if needed for ID generation.
