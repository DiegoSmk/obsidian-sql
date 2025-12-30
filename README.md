# MySQL Runner (Obsidian Plugin)

Execute SQL queries directly from your notes using an in-memory database powered by AlaSQL. Manage multiple databases, import/export CSVs, and enjoy persistent schemas!

![MySQL Runner Demo](https://raw.githubusercontent.com/DiegoSmk/obsidian-sql/master/screenshot.png)

## 🚀 Features

- **In-Memory SQL**: Powered by AlaSQL with MySQL compatibility mode.
- **SQL Forms (New)**: Generate dynamic HTML forms from table schemas for instant data entry.
- **Multi-Database Support**: Create and switch between isolated database environments (e.g., `work`, `learning`, `dbo`).
- **Persistent Schema**: Your `CREATE TABLE` definitions are preserved across reloads.
- **Parameterized Queries**: Support for `:variable` syntax with dynamic UI input fields.
- **CSV Support**: Import data from CSV files in your Vault and export tables back to CSV.
- **Lazy Loading**: High-performance rendering for large result sets (paginated by 50 rows).
- **Syntax Highlighting**: Beautiful SQL highlighting in both live preview and reading mode.

## 🛠️ Usage

### Basic Query
Create a code block with the `mysql` language:

```mysql
CREATE TABLE users (id INT, name TEXT);
INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob');
SELECT * FROM users;
```

Click **Run** to see the results.

### Parameterized Queries
```mysql
SELECT * FROM users WHERE id = :userId;
```
An input box for `userId` will automatically appear.

## ⚙️ Settings

Management controls are located in the **Plugin Settings**:
- **Switch Database**: Change the active SQL context.
- **New Database**: Create a new isolated database.
- **CSV Import/Export**: Manage your data files.
- **Data Maintenance**: View all tables or reset the current database.

## 📥 Installation

### From Community Plugins (Pending)
1. Open Obsidian Settings > Community Plugins.
2. Search for "MySQL Runner".
3. Click Install and Enable.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create folder `.obsidian/plugins/obsidian-mysql-runner`.
3. Move the downloaded files into that folder.
4. Reload Obsidian and enable the plugin.

## 📄 License

MIT License. See `LICENSE` for details.
