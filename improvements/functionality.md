# Functionality Improvements

## 1. CSV Import/Export
- **Goal**: Easier data migration.
- **Details**: 
    - Add an "Import CSV" button to load data into a table from a local file.
    - Enhance "Export" to allow downloading specific tables as CSV, not just the raw JSON dump.

## 2. Multi-Database Support
- **Goal**: Isolate different projects.
- **Details**: Currently we default to a single `empresa` database. Allow users to `CREATE DATABASE project_b` and switch contexts persistently.

## 3. Persistent Schema
- **Goal**: Preserve table structures without data.
- **Details**: Save the `CREATE TABLE` definitions separately so that even if data is wiped, the structure remains.

## 4. Parameterized Queries
- **Goal**: Prototyping dynamic queries.
- **Details**: Support variable syntax like `SELECT * FROM users WHERE id = :id` and provide an input field for `:id` before execution.
