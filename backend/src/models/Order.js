// orders jadvali sxemasi va so'rovlari
const db = require('../database/connection');

const STATUSES = {
  new: '🆕 Yangi',
  accepted: '👨‍🍳 Tayyorlanmoqda',
  ready: '📦 Tayyor — kuryer kutmoqda',
  delivering: '🛵 Yoʻlda',
  done: '✅ Yetkazildi',
  cancelled: '❌ Bekor qilindi',
};

const PAYMENT_STATUSES = {
  pending: '⏳ Kutilmoqda',
  paid: '✅ Toʻlangan',
  on_delivery: '💵 Yetkazilganda',
  manual: '🪙 Operator tasdiqlaydi',
};

const Order = {
  STATUSES,
  PAYMENT_STATUSES,

  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id                    SERIAL PRIMARY KEY,
        user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
        telegram_id           BIGINT NOT NULL,
        customer_name         TEXT NOT NULL,
        phone                 TEXT NOT NULL,
        address               TEXT NOT NULL,
        comment               TEXT,
        items                 JSONB NOT NULL,
        bump_added            BOOLEAN NOT NULL DEFAULT FALSE,
        bump_price            INTEGER NOT NULL DEFAULT 0,
        subtotal              INTEGER NOT NULL,
        savings               INTEGER NOT NULL DEFAULT 0,
        delivery_fee          INTEGER NOT NULL DEFAULT 0,
        total                 INTEGER NOT NULL,
        total_stars           INTEGER,
        payment_method        TEXT NOT NULL,
        payment_status        TEXT NOT NULL DEFAULT 'pending',
        payment_charge_id     TEXT,
        status                TEXT NOT NULL DEFAULT 'new',
        admin_message_id      BIGINT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.query('CREATE INDEX IF NOT EXISTS orders_telegram_id_idx ON orders (telegram_id)');
    await db.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS coins_spent   INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS coins_charged BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS coins_earned  INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS lat           DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS lng           DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS branch_id     INTEGER,
        ADD COLUMN IF NOT EXISTS order_type    TEXT NOT NULL DEFAULT 'delivery',
        ADD COLUMN IF NOT EXISTS table_no      TEXT,
        ADD COLUMN IF NOT EXISTS lang          TEXT NOT NULL DEFAULT 'uz';
    `);
  },

  // Umumiy yangilash (faqat ruxsat berilgan ustunlar)
  async patch(id, fields) {
    const allowed = ['coins_spent', 'coins_charged', 'coins_earned', 'status'];
    const sets = [];
    const values = [id];
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue;
      values.push(v);
      sets.push(`${k} = $${values.length}`);
    }
    if (!sets.length) return this.findById(id);
    const { rows } = await db.query(
      `UPDATE orders SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async create(data) {
    const { rows } = await db.query(
      `INSERT INTO orders (
         user_id, telegram_id, customer_name, phone, address, comment, items,
         bump_added, bump_price, subtotal, savings, delivery_fee, total, total_stars,
         payment_method, payment_status, coins_spent, lat, lng, branch_id, order_type, table_no, lang
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [
        data.userId,
        data.telegramId,
        data.customerName,
        data.phone,
        data.address,
        data.comment || null,
        JSON.stringify(data.items),
        data.bumpAdded,
        data.bumpPrice,
        data.subtotal,
        data.savings,
        data.deliveryFee,
        data.total,
        data.totalStars,
        data.paymentMethod,
        data.paymentStatus,
        data.coinsSpent || 0,
        data.lat ?? null,
        data.lng ?? null,
        data.branchId ?? null,
        data.orderType || 'delivery',
        data.tableNo || null,
        data.lang || 'uz',
      ]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async markPaid(id, chargeId) {
    const { rows } = await db.query(
      `UPDATE orders SET payment_status = 'paid', payment_charge_id = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, chargeId]
    );
    return rows[0] || null;
  },

  async setStatus(id, status) {
    if (!STATUSES[status]) throw new Error(`Notoʻgʻri status: ${status}`);
    const { rows } = await db.query(
      'UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, status]
    );
    return rows[0] || null;
  },

  async setAdminMessage(id, messageId) {
    await db.query('UPDATE orders SET admin_message_id = $2 WHERE id = $1', [id, messageId]);
  },

  async listByTelegramId(telegramId, limit = 10) {
    const { rows } = await db.query(
      `SELECT * FROM orders WHERE telegram_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [telegramId, limit]
    );
    return rows;
  },

  // Admin: buyurtmalar ro'yxati (to'lanmagan onlayn buyurtmalar ko'rsatilmaydi)
  // statuses: massiv (rolga qarab ko'rinadigan holatlar) yoki null (hammasi)
  async listForAdmin(statuses, limit = 50, branchId = null) {
    const params = [limit];
    let where = "o.payment_status <> 'pending'";
    if (branchId) {
      params.push(branchId);
      where += ` AND o.branch_id = $${params.length}`;
    }
    if (statuses && statuses.length) {
      params.push(statuses);
      where += ` AND o.status = ANY($${params.length})`;
    }
    const { rows } = await db.query(
      `SELECT o.*, u.username
         FROM orders o LEFT JOIN users u ON u.id = o.user_id
        WHERE ${where}
        ORDER BY o.created_at DESC
        LIMIT $1`,
      params
    );
    return rows;
  },

  // Admin: statistika (Toshkent vaqti bo'yicha)
  async stats() {
    const VALID = "o.status <> 'cancelled' AND o.payment_status <> 'pending'";
    const [daily, totals, statuses, top] = await Promise.all([
      db.query(`
        SELECT to_char(d, 'DD.MM') AS day,
               COALESCE(SUM(o.total), 0)::int AS revenue,
               COUNT(o.id)::int AS orders
          FROM generate_series((NOW() AT TIME ZONE 'Asia/Tashkent')::date - 6,
                               (NOW() AT TIME ZONE 'Asia/Tashkent')::date, INTERVAL '1 day') d
          LEFT JOIN orders o
            ON (o.created_at AT TIME ZONE 'Asia/Tashkent')::date = d::date AND ${VALID}
         GROUP BY d ORDER BY d`),
      db.query(`
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::bigint AS revenue,
               COUNT(DISTINCT telegram_id)::int AS customers
          FROM orders o WHERE ${VALID}`),
      db.query(`
        SELECT status, COUNT(*)::int AS n FROM orders o
         WHERE o.payment_status <> 'pending' GROUP BY status`),
      db.query(`
        SELECT item->>'name' AS name, SUM((item->>'qty')::int)::int AS qty,
               SUM((item->>'lineTotal')::int)::int AS revenue
          FROM orders o, jsonb_array_elements(o.items) item
         WHERE ${VALID}
         GROUP BY 1 ORDER BY 2 DESC LIMIT 5`),
    ]);
    return {
      daily: daily.rows,
      totals: { ...totals.rows[0], revenue: Number(totals.rows[0].revenue) },
      statuses: Object.fromEntries(statuses.rows.map((r) => [r.status, r.n])),
      top: top.rows,
    };
  },

  async countByTelegramId(telegramId) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM orders
       WHERE telegram_id = $1 AND status <> 'cancelled'`,
      [telegramId]
    );
    return rows[0].total;
  },
};

module.exports = Order;
