const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /products — 상품 목록 (검색 + 카테고리 필터)
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let query  = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      // $N을 두 컬럼에 동시에 사용 (PostgreSQL은 동일 파라미터 중복 허용)
      query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ' ORDER BY id';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /products/:id — 상품 상세
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
