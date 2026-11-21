// banners jadvali — reklama bannerlari (bosh sahifadagi karusel va pastki banner)
const db = require('../database/connection');
const { CONTENT } = require('../utils/i18n');

let cache = [];

const SEED = [
  {
    placement: 'hero',
    kicker: 'Bugungi taklif',
    title: 'Afsonaviy pitsalar',
    subtitle: 'Issiq. Tez. 30 daqiqada eshigingizda.',
    image: '/images/hero.jpg',
    ctaLabel: 'Yangi buyurtma berish',
    action: 'category:hit',
    theme: 'red',
  },
  {
    placement: 'hero',
    kicker: 'Yangilik',
    title: 'Trufelli qoʻziqorin',
    subtitle: 'Haqiqiy trufel moyi va qaymoqli sous.',
    image: '/images/truffle.jpg',
    ctaLabel: 'Tatib koʻrish',
    action: 'product:truffle',
    theme: 'dark',
  },
  {
    placement: 'hero',
    kicker: 'Bepul yetkazish',
    title: '150 000 soʻmdan',
    subtitle: 'yuqori har qanday buyurtmaga — shahar boʻylab.',
    image: '/images/promo.jpg',
    ctaLabel: 'Menyuni ochish',
    action: 'catalog',
    theme: 'gold',
  },
  {
    placement: 'bottom',
    kicker: 'Hafta oxiri maxsus',
    title: 'Barcha pitsalarga 25% gacha chegirma',
    subtitle: 'Promokod shart emas — narxlar allaqachon yangilangan.',
    image: '/images/pepperoni.jpg',
    ctaLabel: 'Buyurtma',
    action: 'catalog',
    theme: 'red',
  },
];

function toBanner(r) {
  return {
    id: r.id,
    placement: r.placement,
    kicker: r.kicker,
    title: r.title,
    subtitle: r.subtitle,
    image: r.image,
    ctaLabel: r.cta_label,
    action: r.action,
    theme: r.theme,
    details: r.details || '',
    i18n: r.i18n || {},
    isActive: r.is_active,
    sortOrder: r.sort_order,
  };
}

const FIELD_MAP = {
  placement: 'placement',
  kicker: 'kicker',
  title: 'title',
  subtitle: 'subtitle',
  image: 'image',
  ctaLabel: 'cta_label',
  action: 'action',
  theme: 'theme',
  details: 'details',
  i18n: 'i18n',
  isActive: 'is_active',
  sortOrder: 'sort_order',
};

const Banner = {
  PLACEMENTS: ['hero', 'bottom'],
  THEMES: ['red', 'dark', 'gold', 'green'],

  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id          SERIAL PRIMARY KEY,
        placement   TEXT NOT NULL DEFAULT 'hero',
        kicker      TEXT NOT NULL DEFAULT '',
        title       TEXT NOT NULL,
        subtitle    TEXT NOT NULL DEFAULT '',
        image       TEXT NOT NULL,
        cta_label   TEXT NOT NULL DEFAULT 'Buyurtma berish',
        action      TEXT NOT NULL DEFAULT 'catalog',
        theme       TEXT NOT NULL DEFAULT 'red',
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.query("ALTER TABLE banners ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT ''");
    await db.query("ALTER TABLE banners ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}'");
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM banners');
    if (rows[0].n === 0) {
      for (const [i, b] of SEED.entries()) await this.create({ ...b, sortOrder: i }, { reload: false });
    }
    for (const [title, tr] of Object.entries(CONTENT.banners)) {
      await db.query("UPDATE banners SET i18n = $2 WHERE title = $1 AND i18n = '{}'::jsonb", [title, JSON.stringify(tr)]);
    }
    await this.reload();
  },

  async reload() {
    const { rows } = await db.query('SELECT * FROM banners ORDER BY sort_order, id');
    cache = rows.map(toBanner);
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

  async create(data, { reload = true } = {}) {
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM banners');
    const { rows } = await db.query(
      `INSERT INTO banners (placement, kicker, title, subtitle, image, cta_label, action, theme, sort_order, details, i18n)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.placement, data.kicker || '', data.title, data.subtitle || '', data.image, data.ctaLabel || 'Buyurtma berish',
        data.action || 'catalog', data.theme || 'red', data.sortOrder ?? maxRows[0].n, data.details || '',
        JSON.stringify(data.i18n || {})]
    );
    if (reload) await this.reload();
    return toBanner(rows[0]);
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
      `UPDATE banners SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    await this.reload();
    return rows[0] ? toBanner(rows[0]) : null;
  },
};

module.exports = Banner;
