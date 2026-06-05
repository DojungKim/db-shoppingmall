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

// ── 응답 시간 측정 미들웨어 ───────────────────────────────────
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = (Number(process.hrtime.bigint() - start) / 1_000_000).toFixed(2);
    console.log(`[${req.method}] ${req.path} — ${ms}ms  (${res.statusCode})`);
  });
  next();
});

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
         p.price                                       AS current_price,
         COALESCE(SUM(oi.quantity), 0)                 AS total_quantity_sold,
         COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
       FROM products p
       LEFT JOIN order_items oi ON p.id = oi.product_id
       GROUP BY p.id, p.name, p.category, p.price
       ORDER BY total_revenue DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /benchmark — 쿼리 유형별 실행 시간 측정
app.get('/benchmark', async (req, res) => {
  const N = Math.min(parseInt(req.query.runs) || 10, 50); // 최대 50회

  const tests = [
    {
      name: '단순 SELECT (상품 목록)',
      query: 'SELECT * FROM products ORDER BY id',
      params: [],
    },
    {
      name: 'ILIKE 검색 (상품명 + 설명)',
      query: "SELECT * FROM products WHERE name ILIKE $1 OR description ILIKE $1",
      params: ['%노트북%'],
    },
    {
      name: 'JOIN 2단계 (주문 + 상품)',
      query: `SELECT o.id, o.user_name, o.total_amount, p.name, oi.quantity
              FROM orders o
              JOIN order_items oi ON o.id = oi.order_id
              JOIN products     p  ON oi.product_id = p.id`,
      params: [],
    },
    {
      name: 'GROUP BY 집계 (매출 통계)',
      query: `SELECT p.id, p.name,
                COALESCE(SUM(oi.quantity), 0) AS total_qty,
                COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
              FROM products p
              LEFT JOIN order_items oi ON p.id = oi.product_id
              GROUP BY p.id, p.name
              ORDER BY total_revenue DESC`,
      params: [],
    },
  ];

  try {
    const results = [];

    for (const test of tests) {
      const times = [];

      for (let i = 0; i < N; i++) {
        const start = process.hrtime.bigint();
        await pool.query(test.query, test.params);
        const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
        times.push(elapsed);
      }

      const avg = times.reduce((a, b) => a + b, 0) / N;
      results.push({
        name:   test.name,
        runs:   N,
        avg_ms: parseFloat(avg.toFixed(3)),
        min_ms: parseFloat(Math.min(...times).toFixed(3)),
        max_ms: parseFloat(Math.max(...times).toFixed(3)),
      });
    }

    res.json(results);
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
