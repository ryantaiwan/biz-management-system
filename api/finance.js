const { query, getMonthStart } = require('../lib/db');

function send(res, code, data) {
  res.status(code).json(data);
}

module.exports = async (req, res) => {
  try {
    const totalIncomeResult = await query(`SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='income'`);
    const totalExpenseResult = await query(`SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='expense'`);

    const trendResult = await query(`
      SELECT
        strftime('%Y-%m', tx_date) as month,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE tx_date >= ?
      GROUP BY strftime('%Y-%m', tx_date)
      ORDER BY month
    `, [getMonthStart(11)]);

    const catResult = await query(`
      SELECT category, COALESCE(SUM(amount),0) as total
      FROM transactions WHERE type='expense'
      GROUP BY category ORDER BY total DESC
    `);

    const totalIncome = totalIncomeResult.rows[0].v;
    const totalExpense = totalExpenseResult.rows[0].v;

    return send(res, 200, {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      trend: trendResult.rows,
      expenseByCategory: catResult.rows
    });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
