// addresses jadvali — mijozning saqlangan manzillari (bir nechta bo'lishi mumkin)
const db = require('../database/connection');

function toAddress(r) {
  return {
    id: r.id,
    label: r.label,
    address: r.address,
    apartment: r.apartment,
    entrance: r.entrance,
    floor: r.floor,
    note: r.note,
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    isDefault: r.is_default,
  };
}

/** Kuryer uchun to'liq manzil satri */
function formatAddress(a) {
  const parts = [a.address];
  if (a.apartment) parts.push(`xonadon/ofis ${a.apartment}`);
  if (a.entrance) parts.push(`${a.entrance}-podyezd`);
  if (a.floor) parts.push(`${a.floor}-qavat`);
  let text = parts.join(', ');
  if (a.note) text += ` (moʻljal: ${a.note})`;
  return text;
}

const MAX_PER_USER = 10;

const Address = {
  formatAddress,

  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id          SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL,
        label       TEXT NOT NULL DEFAULT 'Uy',
        address     TEXT NOT NULL,
        apartment   TEXT NOT NULL DEFAULT '',
        entrance    TEXT NOT NULL DEFAULT '',
        floor       TEXT NOT NULL DEFAULT '',
        note        TEXT NOT NULL DEFAULT '',
        lat         DOUBLE PRECISION,
        lng         DOUBLE PRECISION,
        is_default  BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.query('CREATE INDEX IF NOT EXISTS addresses_tg_idx ON addresses (telegram_id)');
  },

  async list(telegramId) {
    const { rows } = await db.query(
      'SELECT * FROM addresses WHERE telegram_id = $1 ORDER BY is_default DESC, created_at DESC',
      [telegramId]
    );
    return rows.map(toAddress);
  },

  async findOne(telegramId, id) {
    const { rows } = await db.query('SELECT * FROM addresses WHERE telegram_id = $1 AND id = $2', [telegramId, id]);
    return rows[0] ? toAddress(rows[0]) : null;
  },

  async create(telegramId, data) {
    const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS n FROM addresses WHERE telegram_id = $1', [
      telegramId,
    ]);
    if (countRows[0].n >= MAX_PER_USER) throw new Error(`Koʻpi bilan ${MAX_PER_USER} ta manzil saqlash mumkin`);
    const makeDefault = countRows[0].n === 0 || Boolean(data.isDefault);
    if (makeDefault) await db.query('UPDATE addresses SET is_default = FALSE WHERE telegram_id = $1', [telegramId]);
    const { rows } = await db.query(
      `INSERT INTO addresses (telegram_id, label, address, apartment, entrance, floor, note, lat, lng, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [telegramId, data.label, data.address, data.apartment, data.entrance, data.floor, data.note, data.lat, data.lng, makeDefault]
    );
    return toAddress(rows[0]);
  },

  async update(telegramId, id, data) {
    if (data.isDefault) await db.query('UPDATE addresses SET is_default = FALSE WHERE telegram_id = $1', [telegramId]);
    const { rows } = await db.query(
      `UPDATE addresses SET label = $3, address = $4, apartment = $5, entrance = $6, floor = $7, note = $8,
              lat = $9, lng = $10, is_default = is_default OR $11
        WHERE telegram_id = $1 AND id = $2 RETURNING *`,
      [telegramId, id, data.label, data.address, data.apartment, data.entrance, data.floor, data.note, data.lat, data.lng,
        Boolean(data.isDefault)]
    );
    return rows[0] ? toAddress(rows[0]) : null;
  },

  async setDefault(telegramId, id) {
    const existing = await this.findOne(telegramId, id);
    if (!existing) return null;
    await db.query('UPDATE addresses SET is_default = (id = $2) WHERE telegram_id = $1', [telegramId, id]);
    return { ...existing, isDefault: true };
  },

  async remove(telegramId, id) {
    const { rows } = await db.query('DELETE FROM addresses WHERE telegram_id = $1 AND id = $2 RETURNING is_default', [
      telegramId,
      id,
    ]);
    if (rows[0]?.is_default) {
      await db.query(
        `UPDATE addresses SET is_default = TRUE
          WHERE id = (SELECT id FROM addresses WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT 1)`,
        [telegramId]
      );
    }
    return rows.length > 0;
  },
};

module.exports = Address;
