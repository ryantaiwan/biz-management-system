const { query, getMonthStart } = require('../lib/db');
const { send, handleOptions } = require('../lib/helper');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
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
    return send(res, 200, {
      income: ir.total, incomeCount: ir.count,
      expense: er.total, expenseCount: er.count,
      balance: ir.total - er.total,
      inventoryCount: invResult.rows[0].total,
      lowStockCount: lowStockResult.rows[0].total,
      stockValue: stockValueResult.rows[0].total,
      customerCount: custResult.rows[0].total,
      trend: trendResult.rows
    });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
