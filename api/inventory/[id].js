const { query, queryOne } = require('../lib/db');
const { send, handleOptions } = require('../lib/helper');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  const method = req.method;
  const id = req.query.id;

  try {
    if (method === 'GET' && id) {
      const row = await queryOne('SELECT * FROM inventory WHERE id = ?', [id]);
      if (!row) return send(res, 404, { error: 'Not found' });
      return send(res, 200, row);
    }

    if (method === 'PUT' && id) {
      const { name, category, stock, unit, min_stock, unit_price } = req.body;
      const existing = await queryOne('SELECT * FROM inventory WHERE id = ?', [id]);
      if (!existing) return send(res, 404, { error: 'Not found' });
      await query(
        `UPDATE inventory SET name=?, category=?, stock=?, unit=?, min_stock=?, unit_price=?, updated_at=datetime('now','localtime') WHERE id=?`,
        [
          name ?? existing.name, category ?? existing.category,
          stock !== undefined ? Number(stock) : existing.stock,
          unit ?? existing.unit, min_stock !== undefined ? Number(min_stock) : existing.min_stock,
          unit_price !== undefined ? Number(unit_price) : existing.unit_price,
          id
        ]
      );
      const row = await queryOne('SELECT * FROM inventory WHERE id = ?', [id]);
      return send(res, 200, row);
    }

    if (method === 'DELETE' && id) {
      const result = await query('DELETE FROM inventory WHERE id = ?', [id]);
      if (result.changes === 0) return send(res, 404, { error: 'Not found' });
      return send(res, 200, { success: true });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
