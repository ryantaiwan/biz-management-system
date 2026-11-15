const express = require('express');
const cors = require('cors');
const path = require('path');
const { query, queryOne, getMonthStart, USE_TURSO } = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === API Routes (local dev — mirrors Vercel serverless functions) ===

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: USE_TURSO ? 'turso (libsql)' : 'better-sqlite3 (local)',
    tables: ['inventory', 'customers', 'transactions']
  });
});

// ============ INVENTORY ============

app.get('/api/inventory', async (req, res) => {
  try {
    const { search, page = 1, limit = 15 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let where = '';
    let params = [];
    if (search) {
      where = 'WHERE name LIKE ? OR category LIKE ?';
      const kw = '%' + search + '%';
      params = [kw, kw];
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM inventory ${where}`, params);
    const rowsResult = await query(
      `SELECT * FROM inventory ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({ data: rowsResult.rows, total: countResult.rows[0].total, page: pageNum, limit: limitNum });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/inventory/:id', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { name, category, stock, unit, min_stock, unit_price } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await query(
      `INSERT INTO inventory (name, category, stock, unit, min_stock, unit_price) VALUES (?,?,?,?,?,?)`,
      [name, category || '其他', Number(stock) || 0, unit || '個', Number(min_stock) || 0, Number(unit_price) || 0]
    );
    const row = await queryOne('SELECT * FROM inventory WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const { name, category, stock, unit, min_stock, unit_price } = req.body;
    const existing = await queryOne('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await query(
      `UPDATE inventory SET name=?, category=?, stock=?, unit=?, min_stock=?, unit_price=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [
        name ?? existing.name, category ?? existing.category,
        stock !== undefined ? Number(stock) : existing.stock,
        unit ?? existing.unit, min_stock !== undefined ? Number(min_stock) : existing.min_stock,
        unit_price !== undefined ? Number(unit_price) : existing.unit_price,
        req.params.id
      ]
    );
    const row = await queryOne('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM inventory WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ CUSTOMERS ============

app.get('/api/customers', async (req, res) => {
  try {
    const { search, page = 1, limit = 15 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let where = '';
    let params = [];
    if (search) {
      where = 'WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?';
      const kw = '%' + search + '%';
      params = [kw, kw, kw];
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM customers ${where}`, params);
    const rowsResult = await query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({ data: rowsResult.rows, total: countResult.rows[0].total, page: pageNum, limit: limitNum });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await query(
      `INSERT INTO customers (name, phone, email, address, notes) VALUES (?,?,?,?,?)`,
      [name, phone || '', email || '', address || '', notes || '']
    );
    const row = await queryOne('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    const existing = await queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await query(
      `UPDATE customers SET name=?, phone=?, email=?, address=?, notes=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [name ?? existing.name, phone ?? existing.phone, email ?? existing.email, address ?? existing.address, notes ?? existing.notes, req.params.id]
    );
    const row = await queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ TRANSACTIONS ============

app.get('/api/transactions', async (req, res) => {
  try {
    const { type, page = 1, limit = 15 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let where = '';
    let params = [];
    if (type) { where = 'WHERE type = ?'; params = [type]; }

    const countResult = await query(`SELECT COUNT(*) as total FROM transactions ${where}`, params);
    const rowsResult = await query(
      `SELECT * FROM transactions ${where} ORDER BY tx_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({ data: rowsResult.rows, total: countResult.rows[0].total, page: pageNum, limit: limitNum });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { type, amount, category, description, tx_date } = req.body;
    if (!type || !['income','expense'].includes(type)) return res.status(400).json({ error: 'type must be income or expense' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be positive' });
    const result = await query(
      `INSERT INTO transactions (type, amount, category, description, tx_date) VALUES (?,?,?,?,COALESCE(?, datetime('now','localtime')))`,
      [type, Number(amount), category || '其他', description || '', tx_date || null]
    );
    const row = await queryOne('SELECT * FROM transactions WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { type, amount, category, description, tx_date } = req.body;
    const existing = await queryOne('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await query(
      `UPDATE transactions SET type=?, amount=?, category=?, description=?, tx_date=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [type ?? existing.type, amount !== undefined ? Number(amount) : existing.amount, category ?? existing.category, description ?? existing.description, tx_date ?? existing.tx_date, req.params.id]
    );
    const row = await queryOne('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ DASHBOARD / STATS ============

app.get('/api/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2,'0')}-01`;

    const incomeResult = await query(`SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM transactions WHERE type='income' AND tx_date >= ?`, [monthStart]);
    const expenseResult = await query(`SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM transactions WHERE type='expense' AND tx_date >= ?`, [monthStart]);
    const invResult = await query('SELECT COUNT(*) as total FROM inventory');
    const lowStockResult = await query('SELECT COUNT(*) as total FROM inventory WHERE stock <= min_stock');
    const stockValueResult = await query('SELECT COALESCE(SUM(stock * unit_price),0) as total FROM inventory');
    const custResult = await query('SELECT COUNT(*) as total FROM customers');
    const trendResult = await query(`SELECT strftime('%Y-%m', tx_date) as month, SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense FROM transactions WHERE tx_date >= ? GROUP BY strftime('%Y-%m', tx_date) ORDER BY month`, [getMonthStart(5)]);

    const ir = incomeResult.rows[0];
    const er = expenseResult.rows[0];
    res.json({
      income: ir.total, incomeCount: ir.count,
      expense: er.total, expenseCount: er.count,
      balance: ir.total - er.total,
      inventoryCount: invResult.rows[0].total,
      lowStockCount: lowStockResult.rows[0].total,
      stockValue: stockValueResult.rows[0].total,
      customerCount: custResult.rows[0].total,
      trend: trendResult.rows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/finance', async (req, res) => {
  try {
    const ti = await query(`SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='income'`);
    const te = await query(`SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='expense'`);
    const trendResult = await query(`SELECT strftime('%Y-%m', tx_date) as month, SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense FROM transactions WHERE tx_date >= ? GROUP BY strftime('%Y-%m', tx_date) ORDER BY month`, [getMonthStart(11)]);
    const catResult = await query(`SELECT category, COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' GROUP BY category ORDER BY total DESC`);

    const totalIncome = ti.rows[0].v;
    const totalExpense = te.rows[0].v;
    res.json({
      totalIncome, totalExpense,
      netProfit: totalIncome - totalExpense,
      trend: trendResult.rows,
      expenseByCategory: catResult.rows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
app.listen(PORT, () => {
  console.log(`\n  生意管理系統已啟動`);
  console.log(`  ────────────────────────`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  資料庫: ${USE_TURSO ? 'Turso (libsql 雲端)' : 'better-sqlite3 (本地 data.db)'}`);
  console.log(`  ────────────────────────\n`);
});
