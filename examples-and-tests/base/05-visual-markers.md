# 05 - Visual Markers and Workbench Features

SQL Notebook provides several visual enhancements to help you organize and identify your queries.

## 🏷️ Query Markers

You can use special characters at the start of your SQL comments (first line) to change the look and behavior of the workbench view.

### 🙈 Auto-collapse (@)
Blocks starting with `@` will automatically collapse when the note is opened, saving space for long documentation.

```mysql
-- @ This query is hidden by default
SELECT 'Click the header to see me!' AS message;
```

### ❗ Alert Marker (!)
Use `!` for critical queries or warnings. The header will use a distinctive color.

```mysql
-- ! CRITICAL: Permanent operation
SELECT 'Use with caution' AS warning;
```

### ❓ Question/Review Marker (?)
Use `?` for experimental queries or things that need review soon.

```mysql
-- ? Is this join optimized?
SELECT * FROM members;
```

### ⭐ Favorite Marker (*)
Use `*` to highlight your most important or frequently used queries.

```mysql
-- * DAILY SUMMARY
SELECT role, COUNT(*) AS qty FROM members GROUP BY role;
```

## 🛠️ Hover Actions

When you hover your mouse over a code block, you'll see two quick-action buttons:
1.  **Copy**: Copies the SQL code directly to your clipboard.
2.  **Edit**: Quickly jumps into the block editor mode.

## 🆘 Help Modal

Whenever you need a refresher on these markers or footer features, click the **❓ Help** icon in the footer of any query result.

---
[Back: Import and Export](./04-import-export.md) | [Next: Settings and Configuration](./06-settings-and-configuration.md)
