# 02 - Dynamic Updates with Parameters

Live blocks also support dynamic parameters, allowing you to create interactive dashboards.

## 🎛️ Real-time Data View

Live blocks update instantly when data in the relevant tables change.

```mysql
USE playground;
LIVE SELECT * FROM inventory;
```

## 📈 Real-time Dashboards

You can have multiple live blocks on the same page reflecting different views of the same data.

```mysql
USE playground;
-- Summary view
LIVE SELECT 
    COUNT(*) as qty_items, 
    SUM(price) as total_value 
FROM inventory;
```

Try adding an item to `inventory` in another block and see both blocks above update!

```mysql
USE playground;
INSERT INTO inventory (item, price) VALUES ('Secret Gadget', 999);
```

---
[Back: Live Basics](./01-live-basics.md)
