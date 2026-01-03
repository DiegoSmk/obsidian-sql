# Performance and Stress Tests

SQL Notebook is designed to be efficient, but it's important to know its limits.

## 🚀 Large Datasets

Let's generate 1000 rows to see how it performs.

```mysql
USE playground;

CREATE TABLE IF NOT EXISTS stress_test (id INT, val NUMBER);
DELETE FROM stress_test;

INSERT INTO stress_test
SELECT _ AS id, RANDOM() * 100 AS val
FROM RANGE(1, 1000);

-- Query with some calculation
SELECT 
    AVG(val) as average, 
    MAX(val) as maximum 
FROM stress_test;
```

> [!INFO] AlaSQL Syntax Note
> When using `RANGE()`, use `_` to select the value. 
> Also, when using `INSERT INTO ... SELECT`, you **must** use aliases (`AS column_name`) that match the target table columns exactly, otherwise values may be inserted as `undefined` (NULL).


## 📦 Batch Operations

You can run many statements separated by semicolons in a single block.

```mysql
CREATE DATABASE IF NOT EXISTS bench_db;
USE bench_db;
CREATE TABLE t1 (id INT);
INSERT INTO t1 VALUES (1);
INSERT INTO t1 VALUES (2);
SELECT * FROM t1;
DROP TABLE t1;
DROP DATABASE bench_db;
```

## 🚦 Yielding and responsiveness

The plugin uses `yield` points during heavy operations (like saving a large database) to keep the Obsidian UI responsive. You should be able to type or scroll even while a large snapshot is being created.

---
[Home: Introduction](../base/01-introduction.md)
