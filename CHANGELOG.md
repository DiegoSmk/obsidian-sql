# Changelog

## [0.6.1] - 2026-01-01
- **Fix**: Improved `LIVE` mode detection logic to handle comments and `USE` statements correctly.
- **Fix**: Implemented robust stripping of the `LIVE` keyword before query execution to prevent parser errors.
- **Fix**: Ensured database anchors (`liveBlockAnchors`) persist correctly by fixing a state-wiping bug in `saveSettings`.
- **Polish**: Removed parameter input rendering for `LIVE` blocks to ensure a cleaner interface.
- **Docs**: Updated examples to use the recommended `USE; LIVE SELECT` syntax.
- **Lint**: Fixed unsafe type assignments in `main.ts` uncovered by the validation script.

## [0.6.0] - 2026-01-01
- **Performance**: Implemented cooperative multitasking (yielding) in database load/save processes to prevent UI freezing on startup.
- **Optimization**: Eliminated redundant disk writes and unified database snapshot process.
- **Lint**: Fixed all remaining strict ESLint errors across the codebase and test suite.
- **Refactor**: Renamed internal database variables and removed redundant type assertions.
- **Polish**: Normalized English locale strings to sentence case (Obsidian Style Guide).
- **Fix**: Corrected execution time display logic in the footer.

## [0.5.5] - 2025-12-31
- **Polish**: Updated English locale messages to use sentence case and removed excessive punctuation (Obsidian Guidelines).

## [0.5.4] - 2025-12-31
- **Lint**: Removed explicit 'any' casts and fixed async method signatures compliant with strict lint rules.

## [0.5.3] - 2025-12-31 (Hotfix)
- **Fix**: Resolved remaining hardcoded English strings in Settings, Table View, and Workbench buttons.
- **Fix**: Corrected "Reset" functionality messages to respect the active language.
- **Fix**: Prevents shadowing of translation function in table render loops.

## [0.5.2] - 2025-12-31
- **Compliance**: Full code audit for Obsidian Plugin submission guidelines.
- **Refactor**: Replaced unsafe style manipulations with CSS classes.
- **Refactor**: Standardized heading creation using Obsidian's `Setting.setHeading()`.
- **Polish**: Removed all console logs and fixed floating promises.
- **Tests**: Achieved 100% pass rate in unit tests (60/60 tests).

## [0.5.1] - 2024-12-31
- **Meta**: Updated plugin description to meet Obsidian Community guidelines.

## [0.5.0] - 2024-12-30

### 🌍 Added
- **Internationalization (i18n)**: Full support for multiple languages with automatic detection of Obsidian's locale.
- **New Languages**: Added support for:
  - 🇧🇷 Portuguese (Brazil)
  - 🇪🇸 Spanish
  - 🇩🇪 German
  - 🇫🇷 French
  - 🇨🇳 Chinese (Simplified)
  - 🇯🇵 Japanese
  - 🇰🇷 Korean
- **Language Settings**: New dropdown in Generic Settings to manually override the language.

### 🛡️ Security
- **XSS Mitigation**: Implemented strict sanitization for all variables in translation strings to prevent HTML injection in error messages.

### ✨ Improved
- **Error Messages**: Standardized error notifications across the app to carry specific details while being translatable.
- UI strings in Modals, Settings, and Workbench are now fully localized.


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
