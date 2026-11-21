// users jadvali sxemasi va so'rovlari
const crypto = require('crypto');
const db = require('../database/connection');
const { normalizeLang } = require('../utils/i18n');

// Qisqa muddatli kesh: har bir API so'rovida bazaga (AQSh, ~0.5s) bormaslik uchun
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // telegram_id -> { user, at, sig }

function cacheSet(user) {
  if (user) cache.set(String(user.telegram_id), { user, at: Date.now(), sig: '' });
  return user;
}

function cacheDrop(telegramId) {
  cache.delete(String(telegramId));
}

const User = {
  cacheDrop,

  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        telegram_id   BIGINT UNIQUE NOT NULL,
        username      TEXT,
        first_name    TEXT,
        last_name     TEXT,
        full_name     TEXT,
        phone         TEXT,
        language_code TEXT,
        is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Xodim roli va coin balansi
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role      TEXT    NOT NULL DEFAULT 'customer',
        ADD COLUMN IF NOT EXISTS coins     INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS lang      TEXT,
        ADD COLUMN IF NOT EXISTS branch_id INTEGER,
        ADD COLUMN IF NOT EXISTS avatar    TEXT;
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_invites (
        token      TEXT PRIMARY KEY,
        role       TEXT NOT NULL,
        created_by BIGINT NOT NULL,
        used_by    BIGINT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS coin_transactions (
        id          SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL,
        amount      INTEGER NOT NULL,
        type        TEXT NOT NULL,
        order_id    INTEGER,
        note        TEXT NOT NULL DEFAULT '',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.query('CREATE INDEX IF NOT EXISTS coin_tx_tg_idx ON coin_transactions (telegram_id)');
    await db.query('ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS branch_id INTEGER');
  },

  // ---------- Til va filial ----------
  async setLang(telegramId, lang) {
    cacheDrop(telegramId);
    const { rows } = await db.query('UPDATE users SET lang = $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING *', [
      telegramId,
      normalizeLang(lang),
    ]);
    return rows[0] || null;
  },

  // Profil rasmi (kichraytirilgan JPEG/WebP data-URL) yoki null — Telegram rasmiga qaytish
  async setAvatar(telegramId, avatar) {
    cacheDrop(telegramId);
    const { rows } = await db.query('UPDATE users SET avatar = $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING *', [
      telegramId,
      avatar,
    ]);
    return rows[0] || null;
  },

  async setBranch(telegramId, branchId) {
    cacheDrop(telegramId);
    const { rows } = await db.query('UPDATE users SET branch_id = $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING *', [
      telegramId,
      branchId,
    ]);
    return rows[0] || null;
  },

  // ---------- Xodimlar ----------
  async setRole(telegramId, role) {
    cacheDrop(telegramId);
    const { rows } = await db.query(
      'UPDATE users SET role = $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING *',
      [telegramId, role]
    );
    return rows[0] || null;
  },

  async listStaff() {
    const { rows } = await db.query(
      `SELECT telegram_id, username, first_name, last_name, full_name, phone, role, branch_id, lang, updated_at
         FROM users WHERE role <> 'customer' ORDER BY role, first_name`
    );
    return rows;
  },

  // Rol bo'yicha xodimlar; branchId berilsa — shu filialga biriktirilgan yoki biriktirilmaganlar
  async staffByRoles(roles, branchId = null) {
    const { rows } = await db.query(
      `SELECT telegram_id, lang FROM users
        WHERE role = ANY($1) AND ($2::int IS NULL OR branch_id IS NULL OR branch_id = $2)`,
      [roles, branchId]
    );
    return rows;
  },

  // branchId — xodim qaysi filialga biriktiriladi (null — barcha filiallar)
  async createInvite(role, createdBy, days = 7, branchId = null) {
    const token = crypto.randomBytes(8).toString('hex');
    await db.query(
      `INSERT INTO staff_invites (token, role, created_by, expires_at, branch_id)
       VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval, $5)`,
      [token, role, createdBy, String(days), branchId]
    );
    return token;
  },

  // Taklif havolasini ishlatadi: bir martalik, muddati o'tmagan bo'lishi kerak
  async useInvite(token, telegramId) {
    cacheDrop(telegramId);
    const { rows } = await db.query(
      `UPDATE staff_invites SET used_by = $2
        WHERE token = $1 AND used_by IS NULL AND expires_at > NOW()
        RETURNING role, branch_id`,
      [token, telegramId]
    );
    if (!rows[0]) return null;
    await this.setRole(telegramId, rows[0].role);
    await this.setBranch(telegramId, rows[0].branch_id || null);
    return { role: rows[0].role, branchId: rows[0].branch_id || null };
  },

  // ---------- Coinlar ----------
  /**
   * Balansni atomar o'zgartiradi (manfiy bo'lib qolmaydi) va tranzaksiyani yozadi.
   * @returns {number|null} yangi balans yoki yetarli coin bo'lmasa null
   */
  async addCoins(telegramId, amount, type, orderId = null, note = '') {
    cacheDrop(telegramId);
    const { rows } = await db.query(
      `WITH u AS (
         UPDATE users SET coins = coins + $2, updated_at = NOW()
          WHERE telegram_id = $1 AND coins + $2 >= 0
          RETURNING coins
       ), t AS (
         INSERT INTO coin_transactions (telegram_id, amount, type, order_id, note)
         SELECT $1, $2, $3, $4, $5 FROM u
       )
       SELECT coins FROM u`,
      [telegramId, amount, type, orderId, note]
    );
    return rows[0] ? rows[0].coins : null;
  },

  async coinHistory(telegramId, limit = 20) {
    const { rows } = await db.query(
      `SELECT amount, type, order_id, note, created_at FROM coin_transactions
        WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [telegramId, limit]
    );
    return rows;
  },

  async upsertCached(tgUser) {
    const sig = [tgUser.username, tgUser.first_name, tgUser.last_name, tgUser.language_code].join('|');
    const hit = cache.get(String(tgUser.id));
    if (hit && hit.sig === sig && Date.now() - hit.at < CACHE_TTL_MS) return hit.user;
    const user = await this.upsertFromTelegram(tgUser);
    cache.set(String(tgUser.id), { user, at: Date.now(), sig });
    return user;
  },

  // Telegram foydalanuvchisini yaratadi yoki yangilaydi
  async upsertFromTelegram(tgUser) {
    const { rows } = await db.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, language_code, lang)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (telegram_id) DO UPDATE SET
         username      = EXCLUDED.username,
         first_name    = EXCLUDED.first_name,
         last_name     = EXCLUDED.last_name,
         language_code = EXCLUDED.language_code,
         updated_at    = NOW()
       RETURNING *`,
      [
        tgUser.id,
        tgUser.username || null,
        tgUser.first_name || null,
        tgUser.last_name || null,
        tgUser.language_code || null,
        null, // til — foydalanuvchi Mini App'da o'zi tanlaydi
      ]
    );
    return rows[0];
  },

  async findByTelegramId(telegramId) {
    const { rows } = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    return rows[0] || null;
  },

  async updateContact(telegramId, { fullName, phone }) {
    cacheDrop(telegramId);
    const { rows } = await db.query(
      `UPDATE users SET
         full_name  = COALESCE($2, full_name),
         phone      = COALESCE($3, phone),
         updated_at = NOW()
       WHERE telegram_id = $1
       RETURNING *`,
      [telegramId, fullName || null, phone || null]
    );
    return rows[0] || null;
  },

  async count() {
    const { rows } = await db.query('SELECT COUNT(*)::int AS total FROM users');
    return rows[0].total;
  },
};

module.exports = User;
