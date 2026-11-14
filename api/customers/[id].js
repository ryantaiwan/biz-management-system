const { query, queryOne } = require('../../lib/db');
const { send, handleOptions } = require('../../lib/helper');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  const method = req.method;
  const id = req.query.id;

  try {
    if (method === 'GET' && id) {
      const row = await queryOne('SELECT * FROM customers WHERE id = ?', [id]);
      if (!row) return send(res, 404, { error: 'Not found' });
      return send(res, 200, row);
    }

    if (method === 'PUT' && id) {
      const { name, phone, email, address, notes } = req.body;
      const existing = await queryOne('SELECT * FROM customers WHERE id = ?', [id]);
      if (!existing) return send(res, 404, { error: 'Not found' });
      await query(
        `UPDATE customers SET name=?, phone=?, email=?, address=?, notes=?, updated_at=datetime('now','localtime') WHERE id=?`,
        [name ?? existing.name, phone ?? existing.phone, email ?? existing.email, address ?? existing.address, notes ?? existing.notes, id]
      );
      const row = await queryOne('SELECT * FROM customers WHERE id = ?', [id]);
      return send(res, 200, row);
    }

    if (method === 'DELETE' && id) {
      const result = await query('DELETE FROM customers WHERE id = ?', [id]);
      if (result.changes === 0) return send(res, 404, { error: 'Not found' });
      return send(res, 200, { success: true });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
