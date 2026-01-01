# 03 - Joins and Aggregates

In this section, we'll explore how to relate multiple tables and summarize data.

## 🏗️ Setup Relationships

Let's create a `projects` table and link it to our `members`.

```mysql
USE playground;

CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title STRING,
    lead_id INT
);

INSERT INTO projects (title, lead_id) VALUES ('Obsidian Plugin', 1);
INSERT INTO projects (title, lead_id) VALUES ('Database Engine', 2);
```

## 🔗 Inner Join

Combine rows from two tables where there's a match.

```mysql
USE playground;

SELECT 
    p.title AS project_name, 
    m.name AS lead_name,
    m.role AS lead_role
FROM projects p
JOIN members m ON p.lead_id = m.id;
```

## 📊 Aggregates (GROUP BY)

Summarize your data by groups.

```mysql
USE playground;

-- Count members per role
SELECT 
    role, 
    COUNT(*) AS qty 
FROM members 
GROUP BY role
ORDER BY qty DESC;
```

---
[Back: CRUD Operations](./02-crud-operations.md) | [Next: Import and Export](./04-import-export.md)
