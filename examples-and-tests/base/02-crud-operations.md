# 02 - CRUD Operations

CRUD stands for **C**reate, **R**ead, **U**pdate, and **D**elete. These are the fundamental operations of any database.

## 📝 Read Data (SELECT)

The most common operation. You can filter, sort, and limit your results.

```mysql
USE playground;

-- Select all developers
SELECT name, joined_at 
FROM members 
WHERE role = 'Developer'
ORDER BY joined_at DESC;
```

## 🔄 Update Data (UPDATE)

Modify existing records based on a condition.

```mysql
USE playground;

-- Promote Bob to Senior Developer
UPDATE members 
SET role = 'Senior Developer' 
WHERE name = 'Bob';

-- Verify the change
SELECT * FROM members WHERE name = 'Bob';
```

## 🗑️ Delete Data (DELETE)

Remove records from a table.

```mysql
USE playground;

-- Remove Charlie
DELETE FROM members WHERE name = 'Charlie';

-- Check total count
SELECT COUNT(*) AS remaining_members FROM members;
```

## 🪄 Upsert (Delete + Insert)

AlaSQL does not have a native `MERGE` command. To ensure a record exists with specific values (upsert), the most reliable way is to delete the existing one and insert it fresh.

```mysql
USE playground;

-- Ensure Eve is in the table with the 'Support' role
DELETE FROM members WHERE name = 'Eve';
INSERT INTO members (name, role) VALUES ('Eve', 'Support');

SELECT * FROM members;
```

---
[Back: Introduction](./01-introduction.md) | [Next: Joins and Aggregates](./03-joins-and-aggregates.md)
