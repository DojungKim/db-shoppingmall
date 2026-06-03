require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const pool     = require('./db');

const productsRouter = require('./routes/products');
const ordersRouter   = require('./routes/orders');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 라우터 등록 ───────────────────────────────────────────────
app.use('/products', productsRouter);
app.use('/orders',   ordersRouter);

// GET /stats — 상품별 매출 집계 (GROUP BY + LEFT JOIN)
app.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.category,
         p.price                              AS current_price,
         COALESCE(SUM(oi.quantity), 0)        AS total_quantity_sold,
         COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
       FROM products p
       LEFT JOIN order_items oi ON p.id = oi.product_id
       LEFT JOIN orders      o  ON oi.order_id = o.id
       GROUP BY p.id, p.name, p.category, p.price
       ORDER BY total_revenue DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users — 사용자 목록 (프론트 드롭다운용)
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 전역 오류 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
