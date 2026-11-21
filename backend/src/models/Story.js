// stories jadvali — bosh sahifadagi storislar (admin va menejerlar boshqaradi)
const db = require('../database/connection');
const config = require('../config/default');
const { CONTENT } = require('../utils/i18n');

let cache = [];

function toStory(r) {
  return {
    id: r.id,
    title: r.title,
    emoji: r.emoji,
    type: r.type,
    gradient: r.gradient || ['#e0483a', '#a91f15'],
    heading: r.heading,
    text: r.text,
    rating: r.rating || null,
    ctaLabel: r.cta_label || '',
    ctaAction: r.cta_action || '',
    // Yuklangan rasm bazada saqlanadi va alohida manzildan beriladi (katalog yengil qolsin)
    image: r.has_upload ? `/api/stories/${r.id}/image?v=${new Date(r.updated_at).getTime()}` : r.image || '',
    hasUpload: r.has_upload,
    i18n: r.i18n || {},
    sortOrder: r.sort_order,
    isActive: r.is_active,
  };
}

const COLUMNS = `id, title, emoji, type, gradient, heading, text, rating, cta_label, cta_action, image,
  (image_data IS NOT NULL) AS has_upload, i18n, sort_order, is_active, updated_at`;

const Story = {
  TYPES: ['promo', 'review', 'case'],

  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        emoji       TEXT NOT NULL DEFAULT '🔥',
        type        TEXT NOT NULL DEFAULT 'promo',
        gradient    JSONB NOT NULL DEFAULT '["#e0483a","#a91f15"]',
        heading     TEXT NOT NULL DEFAULT '',
        text        TEXT NOT NULL DEFAULT '',
        rating      INTEGER,
        cta_label   TEXT NOT NULL DEFAULT '',
        cta_action  TEXT NOT NULL DEFAULT '',
        image       TEXT NOT NULL DEFAULT '',
        image_data  TEXT,
        i18n        JSONB NOT NULL DEFAULT '{}',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Birinchi ishga tushishda config'dagi storislar tarjimalari bilan ko'chiriladi
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM stories');
    if (rows[0].n === 0) {
      for (const [i, s] of config.stories.entries()) {
        const tr = CONTENT.stories[s.id] || {};
        const i18n = {};
        for (const lang of ['ru', 'en']) {
          if (!tr[lang]) continue;
          i18n[lang] = { title: tr[lang].title, heading: tr[lang].heading, text: tr[lang].text };
          if (tr[lang].cta) i18n[lang].ctaLabel = tr[lang].cta;
        }
        await db.query(
          `INSERT INTO stories (title, emoji, type, gradient, heading, text, rating, cta_label, cta_action, i18n, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [s.title, s.emoji, s.type, JSON.stringify(s.gradient), s.heading, s.text, s.rating || null, s.cta?.label || '',
            s.cta?.action || '', JSON.stringify(i18n), i]
        );
      }
    }
    await this.reload();
  },

  async reload() {
    const { rows } = await db.query(`SELECT ${COLUMNS} FROM stories ORDER BY sort_order, id`);
    cache = rows.map(toStory);
    return cache;
  },

  all() {
    return cache;
  },

  active() {
    return cache.filter((s) => s.isActive);
  },

  findById(id) {
    return cache.find((s) => s.id === Number(id)) || null;
  },

  async imageData(id) {
    const { rows } = await db.query('SELECT image_data FROM stories WHERE id = $1', [id]);
    return rows[0]?.image_data || null;
  },

  async create(d) {
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM stories');
    const { rows } = await db.query(
      `INSERT INTO stories (title, emoji, type, gradient, heading, text, rating, cta_label, cta_action, image, image_data, i18n, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [d.title, d.emoji || '🔥', d.type || 'promo', JSON.stringify(d.gradient || ['#e0483a', '#a91f15']), d.heading || '',
        d.text || '', d.rating || null, d.ctaLabel || '', d.ctaAction || '', d.image || '', d.imageData || null,
        JSON.stringify(d.i18n || {}), maxRows[0].n]
    );
    await this.reload();
    return this.findById(rows[0].id);
  },

  async update(id, d) {
    const map = {
      title: 'title',
      emoji: 'emoji',
      type: 'type',
      gradient: 'gradient',
      heading: 'heading',
      text: 'text',
      rating: 'rating',
      ctaLabel: 'cta_label',
      ctaAction: 'cta_action',
      image: 'image',
      imageData: 'image_data',
      i18n: 'i18n',
      sortOrder: 'sort_order',
      isActive: 'is_active',
    };
    const sets = [];
    const values = [Number(id)];
    for (const [k, col] of Object.entries(map)) {
      if (d[k] === undefined) continue;
      values.push(k === 'gradient' || k === 'i18n' ? JSON.stringify(d[k]) : d[k]);
      sets.push(`${col} = $${values.length}`);
    }
    if (!sets.length) return this.findById(id);
    await db.query(`UPDATE stories SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, values);
    await this.reload();
    return this.findById(id);
  },

  // Tartibni o'zgartirish: ids — yangi ketma-ketlik
  async reorder(ids) {
    for (const [i, id] of ids.entries()) await db.query('UPDATE stories SET sort_order = $2 WHERE id = $1', [id, i]);
    await this.reload();
  },

  async remove(id) {
    const { rowCount } = await db.query('DELETE FROM stories WHERE id = $1', [Number(id)]);
    await this.reload();
    return rowCount > 0;
  },
};

module.exports = Story;
