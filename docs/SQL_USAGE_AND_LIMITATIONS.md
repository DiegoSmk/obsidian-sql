# SQL Usage & AlaSQL Limitations

This document tracks specific SQL behaviors, limitations, and workarounds when using the SQL Notebook plugin (powered by AlaSQL).

## Known Issues

### 1. The "$01 is not defined" Error

**Symptoms:**
When executing a complex `INSERT INTO ... SELECT` query, you receive a `ReferenceError: $01 is not defined` in the console.

**Root Cause:**
This is a parser bug in AlaSQL. It occurs when combining three factors:
1.  Using a database prefix (e.g., `dbo.table` or `[dbo].[table]`).
2.  Providing an explicit column list: `INSERT INTO table (col1, col2)`.
3.  Selecting from a complex source or using functions in the `SELECT` clause.

The AlaSQL parser gets "confused" between the column list parentheses and the internal expression evaluation.

**Workaround:**
Remove the explicit column list from the `INSERT` statement and ensure your `SELECT` returns the columns in the exact order they appear in the table schema.

**❌ Fails:**
```sql
INSERT INTO estoque (produto, qtd) 
SELECT 'Item ' || CAST(VALUE AS STRING), RANDOM() * 100
FROM RANGE(1, 1000);
```

**✅ Works:**
```sql
INSERT INTO estoque 
SELECT 'Item ' || CAST(VALUE AS STRING), RANDOM() * 100
FROM RANGE(1, 1000);
```

---

## Technical Implementations

### Bracket Notation
The plugin automatically transforms table names to use bracket notation: `[database].[table]`. 
This is the most stable way to handle cross-database references in AlaSQL and prevents most common parsing ambiguities.

### Forbidden Commands
For security and stability, the following commands are blocked by the `QueryExecutor`:
- `DROP DATABASE`
- `SHUTDOWN`
- `ALTER SYSTEM`

### Safe Mode
When Safe Mode is enabled in settings, structural destruction is blocked:
- `DROP TABLE`
- `TRUNCATE TABLE`
- `ALTER TABLE`

### LIVE Blocks
LIVE query blocks are strictly **Read-Only**. Any attempt to use `INSERT`, `UPDATE`, `DELETE`, or `CREATE` inside a LIVE block will be blocked by the security engine to prevent accidental data corruption during vault re-renders.

---
*Last Updated: 2025-12-30*
