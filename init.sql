-- ============================================================
-- 쇼핑몰 DB 초기화 스크립트
-- ============================================================

-- 기존 테이블 삭제 (의존 순서 역순)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ── 테이블 생성 ───────────────────────────────────────────────

CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  email      VARCHAR(150)  UNIQUE NOT NULL,
  created_at TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200)   NOT NULL,
  description TEXT,
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock       INT            NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category    VARCHAR(100),
  created_at  TIMESTAMP      DEFAULT NOW()
);

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  user_id      INT            NOT NULL REFERENCES users(id),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  status       VARCHAR(50)    DEFAULT 'completed',
  created_at   TIMESTAMP      DEFAULT NOW()
);

CREATE TABLE order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INT            NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT            NOT NULL REFERENCES products(id),
  quantity   INT            NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

-- ── 인덱스 ────────────────────────────────────────────────────

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_user_id    ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ── 샘플 데이터 ───────────────────────────────────────────────

INSERT INTO users (name, email) VALUES
  ('김철수', 'chulsoo@example.com'),
  ('이영희', 'younghee@example.com'),
  ('박민준', 'minjun@example.com');

INSERT INTO products (name, description, price, stock, category) VALUES
  ('노트북 Pro 15',   '고성능 개발자용 노트북, Intel i9, 32GB RAM',      1500000,  10, '전자제품'),
  ('무선 마우스',     '인체공학적 디자인의 2.4GHz 무선 마우스',             45000,  50, '전자제품'),
  ('기계식 키보드',   'Cherry MX 적축, RGB 백라이트 기계식 키보드',        120000,  30, '전자제품'),
  ('모니터 27인치',   'QHD 165Hz 1ms IPS 게이밍 모니터',                  420000,  15, '전자제품'),
  ('책상 매트',       'PU 가죽 대형 책상 매트 (90×45cm)',                  35000, 100, '사무용품'),
  ('USB 허브',        '7포트 USB 3.0 허브, 개별 전원 스위치',              28000,  60, '전자제품'),
  ('웹캠 HD',         '1080p 30fps, 내장 마이크, 자동 초점 웹캠',          75000,  25, '전자제품'),
  ('노트북 거치대',   '알루미늄 접이식 거치대, 6단계 높이 조절',            55000,  40, '사무용품'),
  ('보조 배터리',     '20000mAh PD 65W 초고속 충전 보조 배터리',           89000,   5, '전자제품'),
  ('마우스 패드',     '천연 고무 저소음 마우스 패드 (40×30cm)',             18000,  80, '사무용품');
