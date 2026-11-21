// branches jadvali — filiallar. Yetkazish buyurtmasi eng yaqin filialga yo'naltiriladi
const db = require('../database/connection');

let cache = [];

function toBranch(r) {
  return {
    id: r.id,
    name: r.name,
    i18n: r.i18n || {},
    address: r.address,
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    phone: r.phone,
    openTime: r.open_time,
    closeTime: r.close_time,
    radiusKm: Number(r.radius_km),
    tables: r.tables,
    chatId: r.chat_id || '',
    isActive: r.is_active,
    sortOrder: r.sort_order,
  };
}

const FIELD_MAP = {
  name: 'name',
  i18n: 'i18n',
  address: 'address',
  lat: 'lat',
  lng: 'lng',
  phone: 'phone',
  openTime: 'open_time',
  closeTime: 'close_time',
  radiusKm: 'radius_km',
  tables: 'tables',
  chatId: 'chat_id',
  isActive: 'is_active',
  sortOrder: 'sort_order',
};

/** Ikki nuqta orasidagi masofa (km) — Haversine formulasi */
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const Branch = {
  distanceKm,

  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        i18n        JSONB NOT NULL DEFAULT '{}',
        address     TEXT NOT NULL DEFAULT '',
        lat         DOUBLE PRECISION,
        lng         DOUBLE PRECISION,
        phone       TEXT NOT NULL DEFAULT '',
        open_time   TEXT NOT NULL DEFAULT '10:00',
        close_time  TEXT NOT NULL DEFAULT '23:00',
        radius_km   NUMERIC(5,1) NOT NULL DEFAULT 10,
        tables      INTEGER NOT NULL DEFAULT 10,
        chat_id     TEXT NOT NULL DEFAULT '',
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM branches');
    if (rows[0].n === 0) {
      await db.query(
        `INSERT INTO branches (name, i18n, address) VALUES ($1, $2, $3)`,
        ['Bosh filial', JSON.stringify({ ru: { name: 'Главный филиал' }, en: { name: 'Main branch' } }), 'Manzilni admin paneldan kiriting']
      );
    }
    await this.reload();
  },

  async reload() {
    const { rows } = await db.query('SELECT * FROM branches ORDER BY sort_order, id');
    cache = rows.map(toBranch);
    return cache;
  },

  all() {
    return cache;
  },

  active() {
    return cache.filter((b) => b.isActive);
  },

  findById(id) {
    return cache.find((b) => b.id === Number(id)) || null;
  },

  /**
   * Eng yaqin faol filial. Koordinatali filial bo'lmasa — birinchi faol filial.
   * @returns {{branch, distanceKm: number|null, inRadius: boolean}|null}
   */
  nearest(lat, lng) {
    const list = this.active();
    if (!list.length) return null;
    const withCoords = list.filter((b) => b.lat !== null && b.lng !== null);
    if (lat === null || lat === undefined || !withCoords.length) {
      return { branch: list[0], distanceKm: null, inRadius: true };
    }
    let best = null;
    for (const b of withCoords) {
      const d = distanceKm(lat, lng, b.lat, b.lng);
      if (!best || d < best.distanceKm) best = { branch: b, distanceKm: d };
    }
    return { ...best, inRadius: best.distanceKm <= best.branch.radiusKm };
  },

  /**
   * Filialni o'chiradi. Buyurtmalar tarixi saqlanadi (branch_id qoladi, nomi "o'chirilgan filial" bo'ladi),
   * biriktirilgan xodimlar va taklif havolalari "Barcha filiallar"ga o'tadi.
   */
  async remove(id) {
    const bid = Number(id);
    await db.query('UPDATE users SET branch_id = NULL WHERE branch_id = $1', [bid]);
    await db.query('UPDATE staff_invites SET branch_id = NULL WHERE branch_id = $1', [bid]);
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM orders WHERE branch_id = $1', [bid]);
    const { rowCount } = await db.query('DELETE FROM branches WHERE id = $1', [bid]);
    await this.reload();
    return rowCount > 0 ? { orders: rows[0].n } : null;
  },

  async create(data) {
    const { rows } = await db.query(
      `INSERT INTO branches (name, i18n, address, lat, lng, phone, open_time, close_time, radius_km, tables, chat_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [data.name, JSON.stringify(data.i18n || {}), data.address || '', data.lat ?? null, data.lng ?? null, data.phone || '',
        data.openTime || '10:00', data.closeTime || '23:00', data.radiusKm ?? 10, data.tables ?? 10, data.chatId || '',
        data.isActive ?? true]
    );
    await this.reload();
    return toBranch(rows[0]);
  },

  async update(id, fields) {
    const sets = [];
    const values = [Number(id)];
    for (const [key, column] of Object.entries(FIELD_MAP)) {
      if (fields[key] === undefined) continue;
      values.push(key === 'i18n' ? JSON.stringify(fields[key]) : fields[key]);
      sets.push(`${column} = $${values.length}`);
    }
    if (!sets.length) return this.findById(id);
    const { rows } = await db.query(
      `UPDATE branches SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    await this.reload();
    return rows[0] ? toBranch(rows[0]) : null;
  },
};

module.exports = Branch;
