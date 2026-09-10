const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
const PORT = 3000;
const dbDir = path.join(__dirname, "db");
fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(path.join(dbDir, "store.db"));
const sessions = new Map();

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "123456";
const STORE_WHATSAPP = "201000000000"; // غيّر الرقم قبل الاستخدام الحقيقي

app.use(express.json());
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/admin", (req, res) => {
  if (!getSession(req)) return res.redirect("/login");
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// قاعدة البيانات
db.exec(`
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  image TEXT DEFAULT '',
  category TEXT DEFAULT 'عطور',
  stock INTEGER DEFAULT 0,
  tag TEXT DEFAULT '',
  brand TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  total REAL NOT NULL,
  discount REAL DEFAULT 0,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  name TEXT,
  price REAL,
  quantity INTEGER
);
`);

if (db.prepare("SELECT COUNT(*) AS c FROM products").get().c === 0) {
  const add = db.prepare(`INSERT INTO products(name,description,price,image,category,stock,tag,brand) VALUES(?,?,?,?,?,?,?,?)`);
  const seed = [
    ["سوفاج إلكسير","عطر رجالي قوي بتركيبة فاخرة وحضور ثابت.",549,"https://images.pexels.com/photos/12456280/pexels-photo-12456280.jpeg?auto=compress&cs=tinysrgb&w=900","عطور رجالية",15,"الأكثر طلباً","Dior"],
    ["نوار ليذر","تركيبة جلدية دافئة لمحبي الروائح المميزة.",599,"https://images.pexels.com/photos/36569349/pexels-photo-36569349.jpeg?auto=compress&cs=tinysrgb&w=900","عطور رجالية",10,"جديد","Tom Ford"],
    ["أكوا دي جيو","رائحة منعشة وأنيقة للاستخدام اليومي والمناسبات.",429,"https://images.pexels.com/photos/23319708/pexels-photo-23319708.jpeg?auto=compress&cs=tinysrgb&w=900","عطور رجالية",20,"مميز","Armani"],
    ["بلو دي شانيل","عطر أنيق بطابع كلاسيكي فاخر.",499,"https://images.pexels.com/photos/29611647/pexels-photo-29611647.jpeg?auto=compress&cs=tinysrgb&w=900","عطور نيش",8,"حصري","Chanel"],
    ["روز دي لا نويت","نفحات وردية ناعمة مع لمسة شرقية.",479,"https://images.pexels.com/photos/12456280/pexels-photo-12456280.jpeg?auto=compress&cs=tinysrgb&w=900","عطور نسائية",12,"جديد","Elite"],
    ["عود ملكي","عود شرقي فاخر مناسب لمحبي الروائح الدافئة.",529,"https://images.pexels.com/photos/23319708/pexels-photo-23319708.jpeg?auto=compress&cs=tinysrgb&w=900","عطور شرقية",9,"مميز","Elite"]
  ];
  seed.forEach(p => add.run(...p));
}

function getSession(req) {
  const sid = req.headers.cookie?.match(/(?:^|; )sid=([^;]+)/)?.[1];
  return sid && sessions.get(sid);
}

function requireAuth(req, res, next) {
  if (!getSession(req)) return res.status(401).json({ error: "غير مصرح لك" });
  next();
}

// صفحة لوحة التحكم نفسها محمية، وليس فقط الـ API
app.get("/admin.html", (req, res, next) => {
  if (!getSession(req)) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  }
  const sid = crypto.randomBytes(32).toString("hex");
  sessions.set(sid, { username, createdAt: Date.now() });
  res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`);
  res.json({ success: true });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const sid = req.headers.cookie?.match(/(?:^|; )sid=([^;]+)/)?.[1];
  sessions.delete(sid);
  res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/products", (req, res) => {
  res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all());
});

app.post("/api/products", requireAuth, (req, res) => {
  const { name, description="", price, image="", category="عطور", stock=0, tag="", brand="" } = req.body || {};
  if (!name || price == null || Number(price) < 0) return res.status(400).json({ error: "بيانات المنتج غير صحيحة" });
  const result = db.prepare(`INSERT INTO products(name,description,price,image,category,stock,tag,brand) VALUES(?,?,?,?,?,?,?,?)`).run(name, description, Number(price), image, category, Math.max(0, Number(stock)), tag, brand);
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/products/:id", requireAuth, (req, res) => {
  const { name, description="", price, image="", category="عطور", stock=0, tag="", brand="" } = req.body || {};
  if (!name || price == null) return res.status(400).json({ error: "بيانات المنتج غير صحيحة" });
  db.prepare(`UPDATE products SET name=?,description=?,price=?,image=?,category=?,stock=?,tag=?,brand=? WHERE id=?`).run(name, description, Number(price), image, category, Math.max(0, Number(stock)), tag, brand, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/products/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/orders", (req, res) => {
  const { customer, items, coupon="" } = req.body || {};
  if (!customer?.name || !customer?.phone || !Array.isArray(items) || !items.length) return res.status(400).json({ error: "بيانات الطلب ناقصة" });
  const get = db.prepare("SELECT * FROM products WHERE id=?");
  const checked = [];
  let subtotal = 0;
  for (const item of items) {
    const qty = Math.floor(Number(item.quantity));
    const p = get.get(Number(item.id));
    if (!p || qty < 1) return res.status(400).json({ error: "منتج غير صالح" });
    if (p.stock < qty) return res.status(400).json({ error: `المخزون غير كافٍ للمنتج: ${p.name}` });
    subtotal += p.price * qty;
    checked.push({ ...p, quantity: qty });
  }
  const discount = coupon.trim().toUpperCase() === "LUXE15" ? subtotal * 0.15 : 0;
  const total = Math.max(0, subtotal - discount);
  const tx = db.transaction(() => {
    const order = db.prepare(`INSERT INTO orders(customer_name,phone,address,notes,total,discount) VALUES(?,?,?,?,?,?)`).run(customer.name, customer.phone, customer.address || "", customer.notes || "", total, discount);
    const addItem = db.prepare(`INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES(?,?,?,?,?)`);
    const decrease = db.prepare(`UPDATE products SET stock=stock-? WHERE id=?`);
    checked.forEach(p => { addItem.run(order.lastInsertRowid, p.id, p.name, p.price, p.quantity); decrease.run(p.quantity, p.id); });
    return Number(order.lastInsertRowid);
  });
  const orderId = tx();
  const text = `طلب #${orderId} - عطر النخبة\nالعميل: ${customer.name}\nالهاتف: ${customer.phone}\nالعنوان: ${customer.address || "-"}\nالإجمالي: ${total.toFixed(2)} ر.س`;
  res.json({ orderId, subtotal, discount, total, whatsapp: `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(text)}` });
});

app.get("/api/orders", requireAuth, (req, res) => {
  const orders = db.prepare(`SELECT o.*, GROUP_CONCAT(oi.name || ' × ' || oi.quantity, ', ') AS items FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.id DESC`).all();
  res.json(orders);
});

app.get("/api/orders/:id/items", requireAuth, (req, res) => {
  res.json(db.prepare("SELECT * FROM order_items WHERE order_id=?").all(req.params.id));
});

app.patch("/api/orders/:id/status", requireAuth, (req, res) => {
  const allowed = ["new","processing","shipped","completed","cancelled"];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ error: "حالة غير صحيحة" });
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status, req.params.id);
  res.json({ ok: true });
});

app.get("/api/stats", requireAuth, (req, res) => {
  const products = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  const orders = db.prepare("SELECT COUNT(*) c FROM orders").get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status!='cancelled'").get().s;
  const pending = db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('new','processing')").get().c;
  res.json({ products, orders, revenue, pending });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});