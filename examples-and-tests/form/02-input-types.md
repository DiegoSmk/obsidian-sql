# 02 - Input Types and Validation

SQL Notebook forms support various input types to ensure data quality.

## 🧬 Every Type Supported

```mysql
USE playground;

-- Create an elaborate table for testing forms
CREATE TABLE IF NOT EXISTS contact_form (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name STRING,
    email STRING,
    category STRING,
    priority INT,
    newsletter BOOLEAN,
    notes TEXT
);

FORM contact_form
    id HIDDEN
    name TEXT "Full Name"
    email TEXT "Work Email"
    category SELECT "Department" ("Sales", "Support", "Engineering")
    priority SELECT "Urgency" (1, 2, 3)
    newsletter SELECT "Newsletter?" (true, false)
    notes TEXT "Additional Comments";
```

## 🚀 Behavior
- Clicking **Submit** will automatically generate and execute an `INSERT` or `UPDATE` statement.
- The UI handles the data conversion (e.g., strings to numbers/booleans) for you.

---
[Back: Form Syntax](./01-form-syntax.md)
