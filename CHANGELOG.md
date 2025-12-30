# Changelog

## [0.4.1] - 2025-12-30

### ✨ New Features
- **SQL Forms**: Generating forms from tables is now fully supported via `FORM [table]` syntax.
- **Theme Polish**: Pagination buttons, success/error messages, and modals now perfectly adapt to the Obsidian active theme (accent colors, fonts).
- **Visualization**: Added 'Screenshot' and 'Add to Note' buttons to query results.

### 🐛 Bug Fixes
- **AlaSQL $01 Error**: Resolved parser error with `INSERT INTO ... SELECT` by improving bracket notation support.
- **Cross-Database Ops**: Fixed 'Rename' and 'Duplicate' database features that were failing silently.
- **Query Parser**: Improved robustness of table prefixing logic in `SQLTransformer`.

### 🧪 Testing
- Added comprehensive unit tests for `DatabaseManager` and `QueryExecutor`.
- All tests passing (100% logic coverage for critical paths).

- Added `SQL_USAGE_AND_LIMITATIONS.md` detailing known AlaSQL quirks and workarounds.
- Updated Testing Guide.
- **Professional Guidelines**: Added improved documentation for Security Best Practices (SQL Injection prevention) and Contribution Standards.

---

## [0.4.0] - 2025-12-28
- Initial release of the refactored core architecture.
