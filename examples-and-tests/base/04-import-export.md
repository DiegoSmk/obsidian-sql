# 04 - Import and Export

SQL Notebook makes it easy to move data in and out of your database.

## 📤 Exporting to Note

You can use the **Note** button in any query result to append that data to your active note as a Markdown table.

## 📥 Importing CSV Data

You can simulate CSV imports using SQL blocks. In a real scenario, you can use the File Explorer or specialized commands. 

> [!TIP]
> You can also use the `VALUE` or `RANGE` functions to generate mock data quickly.

```mysql
USE playground;

CREATE TABLE IF NOT EXISTS inventory (item STRING, price NUMBER);

-- Simulating a bulk import using multiple VALUES
INSERT INTO inventory VALUES 
    ("Laptop", 1200),
    ("Monitor", 300),
    ("Keyboard", 50);

SELECT * FROM inventory;
```

## 🖼️ Screenshots

Use the **Screenshot** button (camera icon) to save a beautiful image of your result table, perfect for sharing or documentation.

---
[Back: CRUD Operations](./02-crud-operations.md) | [Next: Visual Markers](./05-visual-markers.md)
