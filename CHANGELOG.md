# Changelog - SQL Notebook

All notable changes to this project will be documented in this file.

## [0.5.0] - 2025-12-29

### Added
- **SQL Forms Module**: Intercept `FORM` commands to dynamically render data entry forms based on table schema.
- **Custom DSL for Forms**: Support for custom labels, input types (`SELECT`, `DATE`, `NUMBER`, etc.), `DEFAULT` values, and `HIDDEN` fields.
- **Form-to-DB Integration**: Automatic `INSERT` generation upon save, with full `DatabaseEventBus` support for instant re-rendering of `LIVE` blocks.
- **Improved Metadata Detection**: Switched to internal AlaSQL metadata for robust primary key and auto-increment detection.
- **Inline Status Feedback**: Forms now feature integrated success and error messages with slide-up animations.

---

### Added
- **Live Blocks Engine**: Introduced the `LIVE SELECT` feature, allowing real-time synchronization between notes and the database.
- **Database Anchoring**: Permanent binding of specific databases to SQL blocks using a robust 16-character `stableId`.
- **Database Event Bus**: New event-driven architecture to propagate data changes across the entire vault.
- **Visual Loading Indicators**: Smooth visual feedback (blur/opacity) when LIVE blocks are re-executing data.
- **Professional Guidelines**: Added new documentation for development standards and feature usage.

### Fixed
- **Identity Robustness**: Switched to a multi-pass 16-character hash for block identity to prevent collisions.
- **Event Filtering**: Optimized modification detection to exclude false positives from complex `SELECT` queries.
- **Schema Restoration**: Improved fallback mechanism for database snapshots with better warning logs for data integrity.
- **Lifecycle Management**: Fixed "zombie" listeners and memory leaks using Obsidian's official `Component` system.

### Changed
- **ProPractice UI**: Redesigned the "Pro Practice" modal to be more educational and supportive.
- **Type Safety**: Introduced `AlaSQLTable` and `AlaSQLColumn` interfaces for safer internal database access.

---

## [0.3.1] - Previous Version
- Initial stable release with basic SQL workbench functionality.
