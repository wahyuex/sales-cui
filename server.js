const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            price REAL NOT NULL,
            stock INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            quantity INTEGER NOT NULL,
            total_price REAL NOT NULL,
            customer_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);
    }
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
// Dashboard
app.get('/', (req, res) => {
    db.all("SELECT * FROM sales ORDER BY created_at DESC LIMIT 5", [], (err, salesRows) => {
        db.get("SELECT SUM(total_price) as total_revenue, COUNT(*) as total_sales FROM sales", [], (err, salesStats) => {
            db.get("SELECT COUNT(*) as total_products FROM products", [], (err, productStats) => {
                res.render('index', {
                    recentSales: salesRows || [],
                    totalRevenue: salesStats?.total_revenue || 0,
                    totalSales: salesStats?.total_sales || 0,
                    totalProducts: productStats?.total_products || 0
                });
            });
        });
    });
});

// Products
app.get('/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY id DESC", [], (err, rows) => {
        res.render('products', { products: rows || [] });
    });
});

app.post('/products', (req, res) => {
    const { name, category, price, stock } = req.body;
    db.run("INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)", [name, category, price, stock], (err) => {
        res.redirect('/products');
    });
});

app.post('/products/delete/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM products WHERE id = ?", [id], (err) => {
        res.redirect('/products');
    });
});

// Sales
app.get('/sales', (req, res) => {
    db.all(`SELECT sales.*, products.name as product_name FROM sales JOIN products ON sales.product_id = products.id ORDER BY sales.id DESC`, [], (err, salesRows) => {
        db.all("SELECT * FROM products", [], (err, productRows) => {
            res.render('sales', { sales: salesRows || [], products: productRows || [] });
        });
    });
});

app.post('/sales', (req, res) => {
    const { product_id, quantity, customer_name } = req.body;
    db.get("SELECT price, stock FROM products WHERE id = ?", [product_id], (err, product) => {
        if (product && product.stock >= quantity) {
            const total_price = product.price * quantity;
            db.run("INSERT INTO sales (product_id, quantity, total_price, customer_name) VALUES (?, ?, ?, ?)", [product_id, quantity, total_price, customer_name], () => {
                db.run("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, product_id], () => {
                    res.redirect('/sales');
                });
            });
        } else {
            res.redirect('/sales?error=stok_tidak_cukup');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
