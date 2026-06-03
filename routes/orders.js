const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// POST /orders — 주문 생성 (트랜잭션)
router.post('/', async (req, res) => {
  const { userId, items } = req.body;
  // items: [{ productId: number, quantity: number }, ...]

  if (!userId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '유저 ID와 주문 항목이 필요합니다.' });
  }

  // 트랜잭션은 단일 클라이언트를 pool에서 직접 꺼내 사용해야 한다
  const client = await pool.connect();

  try {
    // ── BEGIN: 트랜잭션 시작 ─────────────────────────────────
    await client.query('BEGIN');

    let totalAmount  = 0;
    const itemDetails = [];

    for (const item of items) {
      // FOR UPDATE: 동시 주문 시 같은 행의 재고를 잠근다 (Lost Update 방지)
      const { rows } = await client.query(
        'SELECT id, name, price, stock FROM products WHERE id = $1 FOR UPDATE',
        [item.productId]
      );

      if (rows.length === 0) {
        throw new Error(`상품 ID ${item.productId}를 찾을 수 없습니다.`);
      }

      const product = rows[0];

      // 재고 부족 → 예외를 던져 아래 ROLLBACK 블록으로 이동
      if (product.stock < item.quantity) {
        throw new Error(
          `"${product.name}" 재고 부족 (요청: ${item.quantity}개 / 현재: ${product.stock}개)`
        );
      }

      totalAmount += parseFloat(product.price) * item.quantity;
      itemDetails.push({ productId: item.productId, quantity: item.quantity, unitPrice: product.price });
    }

    // orders 테이블 삽입
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING id',
      [userId, totalAmount, 'completed']
    );
    const orderId = orderResult.rows[0].id;

    for (const item of itemDetails) {
      // order_items 삽입
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [orderId, item.productId, item.quantity, item.unitPrice]
      );

      // stock 차감
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    // ── COMMIT: 모든 작업 성공 → 영구 반영 ──────────────────
    await client.query('COMMIT');

    res.status(201).json({
      orderId,
      totalAmount,
      message: '주문이 완료되었습니다.',
    });
  } catch (err) {
    // ── ROLLBACK: 오류 발생 → 전체 취소 ─────────────────────
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    // 트랜잭션 완료 후 반드시 클라이언트를 풀에 반환
    client.release();
  }
});

// GET /orders/:userId — 유저 주문 내역 (orders + order_items + products JOIN)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT
         o.id           AS order_id,
         o.total_amount,
         o.status,
         o.created_at,
         json_agg(
           json_build_object(
             'product_id',   oi.product_id,
             'product_name', p.name,
             'quantity',     oi.quantity,
             'unit_price',   oi.unit_price,
             'subtotal',     oi.quantity * oi.unit_price
           )
           ORDER BY oi.id
         ) AS items
       FROM orders o
       JOIN order_items oi ON o.id  = oi.order_id
       JOIN products     p  ON oi.product_id = p.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
