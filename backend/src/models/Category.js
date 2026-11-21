// categories jadvali — menyu kategoriyalari (admin va menejerlar qo'shadi, tahrirlaydi, o'chiradi)
const db = require('../database/connection');
const config = require('../config/default');
const { CONTENT } = require('../utils/i18n');

let cache = [];

function toCategory(r) {
  return {
    id: r.id,
    title: r.title,
    emoji: r.emoji,
    i18n: r.i18n || {},
    sortOrder: r.sort_order,
    isActive: r.is_active,
  };
}

function slugify(text) {
  const map = { ʻ: '', ʼ: '', "'": '', '`': '' };
  const base = String(text)
    .toLowerCase()
    .replace(/[ʻʼ'`]/g, (c) => map[c] ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return base || 'kategoriya';
}

const Category = {
  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        emoji       TEXT NOT NULL DEFAULT '🍕',
        i18n        JSONB NOT NULL DEFAULT '{}',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Birinchi ishga tushishda boshlang'ich kategoriyalar ("Barchasi" — virtual, bazada saqlanmaydi)
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM categories');
    if (rows[0].n === 0) {
      const list = config.categories.filter((c) => c.id !== 'all');
      for (const [i, c] of list.entries()) {
        const tr = CONTENT.categories[c.id] || {};
        const i18n = {};
        if (tr.ru) i18n.ru = { title: tr.ru };
        if (tr.en) i18n.en = { title: tr.en };
        await db.query('INSERT INTO categories (id, title, emoji, i18n, sort_order) VALUES ($1,$2,$3,$4,$5)', [
          c.id,
          c.title,
          c.emoji,
          JSON.stringify(i18n),
          i,
        ]);
      }
    }
    await this.reload();
  },

  async reload() {
    const { rows } = await db.query('SELECT * FROM categories ORDER BY sort_order, created_at');
    cache = rows.map(toCategory);
    return cache;
  },

  all() {
    return cache;
  },

  active() {
    return cache.filter((c) => c.isActive);
  },

  ids() {
    return cache.map((c) => c.id);
  },

  findById(id) {
    return cache.find((c) => c.id === id) || null;
  },

  async create({ title, emoji, i18n }) {
    let id = slugify(title);
    if (this.findById(id) || id === 'all') id = `${id}-${Date.now().toString(36).slice(-4)}`;
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM categories');
    const { rows } = await db.query(
      'INSERT INTO categories (id, title, emoji, i18n, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, title, emoji || '🍕', JSON.stringify(i18n || {}), maxRows[0].n]
    );
    await this.reload();
    return toCategory(rows[0]);
  },

  async update(id, { title, emoji, i18n, isActive, sortOrder }) {
    const { rows } = await db.query(
      `UPDATE categories SET
         title      = COALESCE($2, title),
         emoji      = COALESCE($3, emoji),
         i18n       = COALESCE($4, i18n),
         is_active  = COALESCE($5, is_active),
         sort_order = COALESCE($6, sort_order)
       WHERE id = $1 RETURNING *`,
      [id, title ?? null, emoji ?? null, i18n ? JSON.stringify(i18n) : null, isActive ?? null, sortOrder ?? null]
    );
    await this.reload();
    return rows[0] ? toCategory(rows[0]) : null;
  },

  // O'chirish: pitsalar o'chmaydi — faqat shu kategoriyadan chiqariladi
  async remove(id) {
    await db.query('UPDATE products SET categories = array_remove(categories, $1) WHERE $1 = ANY(categories)', [id]);
    const { rowCount } = await db.query('DELETE FROM categories WHERE id = $1', [id]);
    await this.reload();
    return rowCount > 0;
  },
};

module.exports = Category;
