// products jadvali — menyu bazada saqlanadi va admin paneldan tahrirlanadi
const db = require('../database/connection');
const config = require('../config/default');
const { CONTENT } = require('../utils/i18n');

let cache = [];

function toProduct(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    // Yuklangan rasm bazada saqlanadi va /api/products/:id/image orqali beriladi
    image: (r.has_upload ?? Boolean(r.image_data))
      ? `/api/products/${encodeURIComponent(r.id)}/image?v=${new Date(r.updated_at).getTime()}`
      : r.image,
    categories: r.categories || [],
    oldPrice: r.old_price,
    price: r.price,
    size: r.size,
    weight: r.weight,
    badge: r.badge || undefined,
    rating: Number(r.rating),
    reviews: r.reviews,
    ingredients: r.ingredients || [],
    isActive: r.is_active,
    sortOrder: r.sort_order,
    coinPrice: r.coin_price || null,
    i18n: r.i18n || {},
  };
}

// API maydoni -> ustun nomi
const FIELD_MAP = {
  name: 'name',
  description: 'description',
  image: 'image',
  categories: 'categories',
  oldPrice: 'old_price',
  price: 'price',
  size: 'size',
  weight: 'weight',
  badge: 'badge',
  ingredients: 'ingredients',
  isActive: 'is_active',
  sortOrder: 'sort_order',
  coinPrice: 'coin_price',
  i18n: 'i18n',
  imageData: 'image_data',
};

// image_data (katta matn) keshga yuklanmaydi — faqat bor-yo'qligi
const COLUMNS = `id, name, description, image, categories, old_price, price, size, weight, badge, rating, reviews,
  ingredients, is_active, sort_order, coin_price, i18n, created_at, updated_at, (image_data IS NOT NULL) AS has_upload`;

function slugify(text) {
  const base = String(text)
    .toLowerCase()
    .replace(/[ʻʼ'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return `${base || 'pizza'}-${Date.now().toString(36).slice(-4)}`;
}

const Product = {
  async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        image       TEXT NOT NULL,
        categories  TEXT[] NOT NULL DEFAULT '{}',
        old_price   INTEGER NOT NULL DEFAULT 0,
        price       INTEGER NOT NULL,
        size        TEXT NOT NULL DEFAULT '30 sm',
        weight      TEXT NOT NULL DEFAULT '',
        badge       TEXT,
        rating      NUMERIC(2,1) NOT NULL DEFAULT 5.0,
        reviews     TEXT NOT NULL DEFAULT 'yangi',
        ingredients JSONB NOT NULL DEFAULT '[]',
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Coin evaziga olish narxi (null — coinga sotilmaydi)
    await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS coin_price INTEGER');
    await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}'");
    await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data TEXT');

    // Birinchi ishga tushishda menyuni config'dan bazaga ko'chiramiz
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM products');
    if (rows[0].n === 0) {
      for (const [i, p] of config.products.entries()) {
        await db.query(
          `INSERT INTO products (id, name, description, image, categories, old_price, price, size, weight,
                                 badge, rating, reviews, ingredients, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [p.id, p.name, p.description, p.image, p.categories, p.oldPrice, p.price, p.size, p.weight,
            p.badge || null, p.rating || 5, p.reviews || 'yangi', JSON.stringify(p.ingredients || []), i]
        );
      }
    }
    // Boshlang'ich menyu tarjimalari (faqat bo'sh bo'lsa)
    for (const [id, tr] of Object.entries(CONTENT.products)) {
      await db.query("UPDATE products SET i18n = $2 WHERE id = $1 AND i18n = '{}'::jsonb", [id, JSON.stringify(tr)]);
    }
    await this.reload();
  },

  async reload() {
    const { rows } = await db.query(`SELECT ${COLUMNS} FROM products ORDER BY sort_order, created_at`);
    cache = rows.map(toProduct);
    return cache;
  },

  all() {
    return cache;
  },

  active() {
    return cache.filter((p) => p.isActive);
  },

  findById(id) {
    return cache.find((p) => p.id === id) || null;
  },

  async imageData(id) {
    const { rows } = await db.query('SELECT image_data FROM products WHERE id = $1', [id]);
    return rows[0]?.image_data || null;
  },

  async update(id, fields) {
    const sets = [];
    const values = [id];
    for (const [key, column] of Object.entries(FIELD_MAP)) {
      if (fields[key] === undefined) continue;
      let value = fields[key];
      if (key === 'ingredients' || key === 'i18n') value = JSON.stringify(value);
      if (key === 'badge' && !value) value = null;
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
    if (!sets.length) return this.findById(id);
    const { rows } = await db.query(
      `UPDATE products SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING ${COLUMNS}`,
      values
    );
    await this.reload();
    return rows[0] ? toProduct(rows[0]) : null;
  },

  async create(data) {
    const id = slugify(data.name);
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM products');
    const { rows } = await db.query(
      `INSERT INTO products (id, name, description, image, categories, old_price, price, size, weight,
                             badge, ingredients, sort_order, coin_price, i18n, image_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING ${COLUMNS}`,
      [id, data.name, data.description || '', data.image || '', data.categories || [], data.oldPrice || 0, data.price,
        data.size || '30 sm', data.weight || '', data.badge || null, JSON.stringify(data.ingredients || []),
        maxRows[0].n, data.coinPrice || null, JSON.stringify(data.i18n || {}), data.imageData || null]
    );
    await this.reload();
    return toProduct(rows[0]);
  },
};

module.exports = Product;
