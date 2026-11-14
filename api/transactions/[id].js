const { query, queryOne } = require('../../lib/db');

function send(res, code, data) {
  res.status(code).json(data);
}

module.exports = async (req, res) => {
  const method = req.method;
  const id = req.query.id;

  try {
    if (method === 'GET' && id) {
      const row = await queryOne('SELECT * FROM transactions WHERE id = ?', [id]);
      if (!row) return send(res, 404, { error: 'Not found' });
      return send(res, 200, row);
    }

    if (method === 'PUT' && id) {
      const { type, amount, category, description, tx_date } = req.body;
      const existing = await queryOne('SELECT * FROM transactions WHERE id = ?', [id]);
      if (!existing) return send(res, 404, { error: 'Not found' });
      await query(
        `UPDATE transactions SET type=?, amount=?, category=?, description=?, tx_date=?, updated_at=datetime('now','localtime') WHERE id=?`,
        [
          type ?? existing.type,
          amount !== undefined ? Number(amount) : existing.amount,
          category ?? existing.category,
          description ?? existing.description,
          tx_date ?? existing.tx_date,
          id
        ]
      );
      const row = await queryOne('SELECT * FROM transactions WHERE id = ?', [id]);
      return send(res, 200, row);
    }

    if (method === 'DELETE' && id) {
      const result = await query('DELETE FROM transactions WHERE id = ?', [id]);
      if (result.changes === 0) return send(res, 404, { error: 'Not found' });
      return send(res, 200, { success: true });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
