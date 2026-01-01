# 06 - Settings and Configuration

Customize SQL Notebook to fit your workflow and ensure your data remains safe and efficient.

## ⚙️ How to access
Go to **Settings (Gear icon)** -> **Community Plugins** -> **SQL Notebook**.

## 🌍 General Settings

- **Language**: Choose between English, Portuguese, Spanish, German, French, Chinese, Japanese, or Korean. The plugin detects your Obsidian language by default.
- **Auto-save**: When enabled, the plugin saves your data periodically. You can adjust the **Auto-save Delay (ms)** to control the frequency.

## 🎨 Appearance

- **Theme Accent**: Choose your preferred color for table borders, headers, and UI elements.
- **Use Obsidian Accent**: Toggle this to automatically match the plugin's color with your current Obsidian theme's accent color.

## 🛡️ Data & Security

- **Safe Mode**: A critical feature for data integrity. When ON, it blocks structural commands like `DROP TABLE` or `ALTER TABLE` in standard query blocks.
- **Snapshot Row Limit**: To prevent performance issues with massive datasets, you can limit how many rows per table are saved to disk (Default list: 10,000).
- **Batch Size**: Controls how many rows are displayed per page in query results.

## 🛠️ Management Tools (Inside Settings)

The settings page isn't just for toggling switches; it's a full database manager:

1.  **Search**: Quickly find any database in your vault.
2.  **Import SQL**: Load data from external `.sql` files.
3.  **Database Actions**: Click on any database to Rename, Duplicate, Clear Data, or Delete.
4.  **Tables Preview**: See row counts and structure directly from the management list.

## 🆘 Troubleshooting

- **Enable Debug Logging**: Turn this on if you're experiencing issues and want to see technical details in the Developer Console (`Ctrl+Shift+I`).
- **Reset All Data**: Use this with extreme caution. It will wipe ALL your databases and tables, restoring the plugin to its factory state.

---
[Back: Visual Markers](./05-visual-markers.md) | [Home: Introduction](./01-introduction.md)
