# 01 - Introduction to SQL Notebook

Welcome to **SQL Notebook**! This plugin allows you to manage relational data directly inside Obsidian using an in-memory SQL engine (AlaSQL).

## 🚀 Key Concepts

1.  **In-Memory Storage**: Your data is stored in memory for lightning-fast queries. 
2.  **Snapshot Persistence**: The plugin automatically saves your database state to your Obsidian settings, so your data persists across restarts.
3.  **Local Context**: Use `USE database_name` to switch contexts, or prefix tables with `dbName.tableName`.

## 🛠️ First Step: Database Setup

Before exploring other examples, let's create our first database and a simple table. Run the block below:

```mysql
-- Create a new database for our playground
CREATE DATABASE IF NOT EXISTS playground;

-- Switch to it
USE playground;

-- Create a basic table
CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name STRING,
    role STRING,
    joined_at DATETIME DEFAULT NOW()
);

-- Insert some initial data
INSERT INTO members (name, role) VALUES ('Alice', 'Architect');
INSERT INTO members (name, role) VALUES ('Bob', 'Developer');
INSERT INTO members (name, role) VALUES ('Charlie', 'Designer');

-- Verify the data
SELECT * FROM members;
```

> [!NOTE]
> Click the **Run** button on the top right of the code block above to execute. Once executed, you can click the **Tables** button in the footer to see the table structure. Explore more tips by clicking the **❓ Help** icon.

---
[Next: CRUD Operations](./02-crud-operations.md)
