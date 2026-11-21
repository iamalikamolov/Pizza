// settings jadvali — admin paneldan o'zgartiriladigan umumiy sozlamalar
const db = require('../database/connection');

const DEFAULTS = {
  coinsEnabled: false, // coin (bonus) dasturi yoqilganmi
  coinsPerThousand: 1, // har 1 000 so'm uchun necha coin yoziladi
  bannerInterval: 5, // reklama karuseli necha soniyada almashadi
};

let cache = { ...DEFAULTS };

const Settings = {
  DEFAULTS,

  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.reload();
  },

  async reload() {
    const { rows } = await db.query('SELECT key, value FROM settings');
    cache = { ...DEFAULTS };
    for (const r of rows) if (r.key in DEFAULTS) cache[r.key] = r.value;
    return cache;
  },

  get() {
    return { ...cache };
  },

  async update(partial) {
    for (const [key, value] of Object.entries(partial)) {
      if (!(key in DEFAULTS)) continue;
      await db.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    return this.reload();
  },
};

module.exports = Settings;
