# 02 - Dynamic Updates with Parameters

Live blocks also support dynamic parameters, allowing you to create interactive dashboards.

## 🎛️ Interactive Filter

Change the `min_price` in the input below and see the results update.

```mysql
/* params: {
  "min_price": 100
} */
LIVE USE playground;
SELECT * FROM inventory WHERE price >= :min_price;
```

## 📈 Real-time Dashboards

You can have multiple live blocks on the same page reflecting different views of the same data.

```mysql
LIVE USE playground;
-- Summary view
SELECT 
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
