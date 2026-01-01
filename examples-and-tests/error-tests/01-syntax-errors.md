# Error Tests Guide

This guide helps you understand how the plugin handles common mistakes and security blocks.

## ‼️ Syntax Errors

If you write invalid SQL, the plugin will catch the error from AlaSQL and display it clearly. Try running this (it has a typo in the keyword):

```mysql
-- Typo in 'SELECT'
SLECT * FROM members;
```

### 🧐 Reserved Words

The database has some internal words that cannot be used as aliases without quotes. The plugin will give you a tip (💡) if it detects one.

```mysql
-- 'TOTAL' is a reserved word
SELECT COUNT(*) AS total FROM members;
```

```mysql
-- 'VALUE' is another reserved word
SELECT name AS value FROM members;
```

### 📁 Missing Tables

```mysql
-- Querying a non-existent table
SELECT * FROM non_existent_table;
```

## 🛡️ Security Blocks

For safety, some commands are blocked in query blocks to prevent accidental data loss or breaking the plugin state.

```mysql
-- This will be blocked
DROP DATABASE dbo;
```

## 🔒 Safe Mode

If **Safe Mode** is enabled in settings, structural changes like `DROP TABLE` are also blocked.

```mysql
-- Blocked if Safe Mode is ON
DROP TABLE members;
```

## 🚫 Read-only (LIVE)

`LIVE` blocks are strictly read-only. They cannot contain `INSERT`, `UPDATE`, or `DELETE`.

```mysql
-- This will fail because it's a mutation in a LIVE block
LIVE INSERT INTO members (name) VALUES ('Hacker');
```

---
[Home: Introduction](../base/01-introduction.md)
