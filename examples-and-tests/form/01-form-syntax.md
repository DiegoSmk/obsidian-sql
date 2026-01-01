# 01 - Form Syntax

The `FORM` command is a powerful feature that generates a graphical interface for data entry directly from your database tables.

## 📝 Simple Form

To create a form, use the `FORM` keyword followed by the table name.

> [!TIP]
> **Automatic Rendering**: If your block contains **only** the `FORM` command (without `USE` or other statements), the plugin will render the form automatically as soon as you stop editing, without needing to click **Run**.

```mysql
FORM members;
```

## ⚓ Block Context (Database Anchoring)

Interactive blocks (`FORM` and `LIVE`) are "anchored" to a specific database. You can change which database a block is targetting by clicking the **Database Selector** button in the block's footer. This allows you to have multiple forms pointing to different databases even on the same note.

## 🎨 Advanced Customization

You can hide fields, rename labels, and change input types using a simple DSL after the `FORM` command.

```mysql
USE playground;

FORM members
    id HIDDEN
    name TEXT "Member Name"
    role SELECT "Project Role" ("Developer", "Designer", "Manager", "Other")
    joined_at DATE "Date Joined";
```

### Features:
- **HIDDEN**: Field exists but is not shown to the user.
- **TEXT**: Standard message input.
- **SELECT**: Dropdown with predefined options.
- **DATE**: Date picker.

---
[Next: Input Types](./02-input-types.md)
