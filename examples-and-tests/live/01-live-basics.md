# 01 - Live Basics

`sql-live` blocks are the magic of this plugin. They update automatically whenever the underlying data changes, without needing to click "Run".

### ⚡ Reactivity in Action

1.  **Run this setup block first**:

```mysql
USE playground;
CREATE TABLE IF NOT EXISTS live_tasks (id INT AUTO_INCREMENT, task STRING, done BOOLEAN);
DELETE FROM live_tasks;
INSERT INTO live_tasks (task, done) VALUES ('Learn SQL', true);
INSERT INTO live_tasks (task, done) VALUES ('Build Plugin', false);
```

2.  **Observe this LIVE block**:
To make a block live, simply start your query with the `LIVE` keyword inside a standard `mysql` block.

```mysql
LIVE USE playground;
SELECT * FROM live_tasks;
```

## 🔄 How to trigger an update?

Run this block and watch the table above change instantly!

```mysql
USE playground;
INSERT INTO live_tasks (task, done) VALUES ('Profit!', false);
```

---
[Next: Dynamic Updates](./02-dynamic-updates.md)
