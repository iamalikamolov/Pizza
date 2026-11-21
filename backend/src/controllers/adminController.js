// Admin panel: statistika, buyurtmalarni boshqarish va menyuni tahrirlash
const config = require('../config/default');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Banner = require('../models/Banner');
const User = require('../models/User');
const Settings = require('../models/Settings');
const bot = require('../core/bot');
const logger = require('../utils/logger');
const { changeOrderStatus, paymentTitle, mapLink } = require('./cartController');
const Branch = require('../models/Branch');
const { ROLES, VISIBLE_STATUSES, canTransition, transitionsFor } = require('../middlewares/auth.middleware');

// Tarjima maydonlari: { ru: {...}, en: {...} } — faqat ruxsat etilgan matnlar
function cleanI18n(raw, fields) {
  const out = {};
  for (const lang of ['ru', 'en']) {
    const src = raw?.[lang] || {};
    const obj = {};
    for (const f of fields) {
      const v = src[f];
      if (Array.isArray(v)) {
        const arr = v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
        if (arr.length) obj[f] = arr;
      } else if (typeof v === 'string' && v.trim()) obj[f] = v.trim().slice(0, f === 'details' ? 2000 : 300);
    }
    if (Object.keys(obj).length) out[lang] = obj;
  }
  return out;
}

const Category = require('../models/Category');
const Story = require('../models/Story');

function fail(res, status, error) {
  return res.status(status).json({ error });
}

// ---------- GET /api/admin/stats ----------
async function getStats(req, res) {
  try {
    const s = await Order.stats();
    const today = s.daily[s.daily.length - 1] || { revenue: 0, orders: 0 };
    const weekRevenue = s.daily.reduce((sum, d) => sum + d.revenue, 0);
    const weekOrders = s.daily.reduce((sum, d) => sum + d.orders, 0);
    res.json({
      today,
      week: { revenue: weekRevenue, orders: weekOrders, avgCheck: weekOrders ? Math.round(weekRevenue / weekOrders) : 0 },
      totals: s.totals,
      daily: s.daily,
      statuses: s.statuses,
      top: s.top,
    });
  } catch (err) {
    logger.error('GET /api/admin/stats xatosi', err);
    fail(res, 500, 'Statistikani yuklab boʻlmadi');
  }
}

// ---------- GET /api/admin/orders?status= ----------
async function listOrders(req, res) {
  try {
    const role = req.role;
    const status = String(req.query.status || 'all');
    if (status !== 'all' && !Order.STATUSES[status]) return fail(res, 400, 'Notoʻgʻri status');
    const visible = VISIBLE_STATUSES[role];
    let statuses = status === 'all' ? visible : [status];
    if (visible && statuses) statuses = statuses.filter((s) => visible.includes(s));
    if (statuses && statuses.length === 0) return res.json([]);
    // Filialga biriktirilgan xodim faqat o'z filialini ko'radi; egasi/menejer ?branch= bilan filtrlaydi
    const ownBranch = req.user.branch_id && role !== 'owner' ? req.user.branch_id : null;
    const branchId = ownBranch || (req.query.branch ? Number(req.query.branch) : null);
    let rows = await Order.listForAdmin(statuses, 60, branchId);
    if (role === 'courier') rows = rows.filter((o) => o.order_type !== 'dinein');
    res.json(
      rows.map((o) => ({
        id: o.id,
        customerName: o.customer_name,
        orderType: o.order_type,
        tableNo: o.table_no || '',
        branchId: o.branch_id,
        branchName: o.branch_id ? Branch.findById(o.branch_id)?.name || 'Oʻchirilgan filial' : '',
        username: o.username || '',
        telegramId: o.telegram_id,
        phone: o.phone,
        address: o.address,
        comment: o.comment || '',
        items: o.items,
        bumpAdded: o.bump_added,
        bumpTitle: o.bump_added ? config.orderBump.title : '',
        subtotal: o.subtotal,
        deliveryFee: o.delivery_fee,
        total: o.total,
        totalStars: o.total_stars,
        paymentMethod: o.payment_method,
        paymentTitle: paymentTitle(o.payment_method),
        paymentStatus: o.payment_status,
        paymentStatusTitle: Order.PAYMENT_STATUSES[o.payment_status],
        status: o.status,
        statusTitle: Order.STATUSES[o.status],
        nextStatuses: transitionsFor(role, o).map((s) => ({ status: s, title: Order.STATUSES[s] })),
        coinsSpent: o.coins_spent,
        mapUrl: mapLink(o),
        createdAt: o.created_at,
      }))
    );
  } catch (err) {
    logger.error('GET /api/admin/orders xatosi', err);
    fail(res, 500, 'Buyurtmalarni yuklab boʻlmadi');
  }
}

// ---------- PATCH /api/admin/orders/:id ----------
async function updateOrderStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '');
    if (!Order.STATUSES[status]) return fail(res, 400, 'Notoʻgʻri status');
    const current = await Order.findById(id);
    if (!current) return fail(res, 404, 'Buyurtma topilmadi');
    if (!canTransition(req.role, current, status)) {
      return fail(res, 403, `Bu holatni oʻzgartirishga ruxsatingiz yoʻq (${Order.STATUSES[current.status]})`);
    }
    const order = await changeOrderStatus(id, status);
    if (!order) return fail(res, 404, 'Buyurtma topilmadi');
    logger.info(`Admin ${req.user.telegram_id}: #${id} -> ${status}`);
    res.json({ id: order.id, status: order.status, statusTitle: Order.STATUSES[order.status] });
  } catch (err) {
    logger.error('PATCH /api/admin/orders xatosi', err);
    fail(res, 500, 'Holatni oʻzgartirib boʻlmadi');
  }
}

// ---------- Menyu ----------
function validateProduct(body, { partial }) {
  const out = {};
  const has = (k) => body[k] !== undefined;

  if (has('name') || !partial) {
    const name = String(body.name || '').trim();
    if (name.length < 2 || name.length > 60) throw new Error('Nom 2–60 belgi boʻlishi kerak');
    out.name = name;
  }
  if (has('description')) out.description = String(body.description || '').trim().slice(0, 300);
  if (has('price') || !partial) {
    const price = Math.round(Number(body.price));
    if (!Number.isFinite(price) || price < 1000 || price > 10000000) throw new Error('Narx 1 000 – 10 000 000 soʻm oraligʻida boʻlsin');
    out.price = price;
  }
  if (has('oldPrice')) {
    const oldPrice = Math.round(Number(body.oldPrice) || 0);
    if (oldPrice < 0 || oldPrice > 10000000) throw new Error('Eski narx notoʻgʻri');
    out.oldPrice = oldPrice;
  }
  if (has('badge')) out.badge = String(body.badge || '').trim().slice(0, 16);
  if (has('size')) out.size = String(body.size || '').trim().slice(0, 20);
  if (has('weight')) out.weight = String(body.weight || '').trim().slice(0, 20);
  if (has('imageUpload')) {
    // Telefondan yuklangan rasm (data URL) — bazada saqlanadi
    const d = String(body.imageUpload || '');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d)) throw new Error('Rasm formati notoʻgʻri (JPEG, PNG yoki WebP)');
    if (d.length > MAX_PRODUCT_IMAGE) throw new Error('Rasm juda katta');
    out.imageData = d;
    out.image = '';
  } else if (has('image') || !partial) {
    const image = String(body.image || '').trim();
    if (!/^(\/images\/[\w.-]+|https:\/\/\S+)$/.test(image)) throw new Error('Rasm tanlang yoki telefondan yuklang');
    out.image = image;
    out.imageData = null; // tayyor rasm tanlansa — yuklangan rasm olib tashlanadi
  }
  if (has('categories')) {
    if (!Array.isArray(body.categories)) throw new Error('Kategoriyalar notoʻgʻri');
    out.categories = body.categories.map(String).filter((c) => Category.ids().includes(c));
  }
  if (has('ingredients')) {
    if (!Array.isArray(body.ingredients)) throw new Error('Tarkib notoʻgʻri');
    out.ingredients = body.ingredients.map((i) => String(i).trim()).filter(Boolean).slice(0, 12);
  }
  if (has('isActive')) out.isActive = Boolean(body.isActive);
  if (has('i18n')) out.i18n = cleanI18n(body.i18n, ['name', 'description', 'ingredients']);
  if (has('coinPrice')) {
    const cp = body.coinPrice === null || body.coinPrice === '' ? null : Math.round(Number(body.coinPrice));
    if (cp !== null && (!Number.isFinite(cp) || cp < 1 || cp > 1000000)) throw new Error('Coin narxi 1 – 1 000 000 oraligʻida boʻlsin');
    out.coinPrice = cp || null;
  }
  return out;
}

function listProducts(req, res) {
  res.json({ products: Product.all(), categories: Category.all() });
}

async function updateProduct(req, res) {
  try {
    const existing = Product.findById(req.params.id);
    if (!existing) return fail(res, 404, 'Mahsulot topilmadi');
    let fields;
    try {
      fields = validateProduct(req.body || {}, { partial: true });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const product = await Product.update(existing.id, fields);
    logger.info(`Admin ${req.user.telegram_id}: mahsulot ${existing.id} yangilandi`);
    res.json(product);
  } catch (err) {
    logger.error('PATCH /api/admin/products xatosi', err);
    fail(res, 500, 'Mahsulotni saqlab boʻlmadi');
  }
}

async function createProduct(req, res) {
  try {
    let fields;
    try {
      fields = validateProduct(req.body || {}, { partial: false });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const product = await Product.create(fields);
    logger.info(`Admin ${req.user.telegram_id}: yangi mahsulot ${product.id}`);
    res.status(201).json(product);
  } catch (err) {
    logger.error('POST /api/admin/products xatosi', err);
    fail(res, 500, 'Mahsulotni qoʻshib boʻlmadi');
  }
}

// ---------- Reklama bannerlari ----------
const ACTION_RE = /^(catalog|cart|bonus|details|category:[a-z-]+|product:[\w-]+|url:https:\/\/\S+)$/;

function validateBanner(body, { partial }) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  const text = (k, max) => String(body[k] || '').trim().slice(0, max);

  if (has('title') || !partial) {
    const title = text('title', 60);
    if (title.length < 2) throw new Error('Sarlavha kamida 2 belgi boʻlsin');
    out.title = title;
  }
  if (has('kicker')) out.kicker = text('kicker', 30);
  if (has('subtitle')) out.subtitle = text('subtitle', 120);
  if (has('ctaLabel') || !partial) {
    const cta = text('ctaLabel', 24);
    if (!cta) throw new Error('Tugma matnini kiriting');
    out.ctaLabel = cta;
  }
  if (has('placement') || !partial) {
    if (!Banner.PLACEMENTS.includes(body.placement)) throw new Error('Joylashuv notoʻgʻri');
    out.placement = body.placement;
  }
  if (has('theme')) {
    if (!Banner.THEMES.includes(body.theme)) throw new Error('Rang notoʻgʻri');
    out.theme = body.theme;
  }
  if (has('action') || !partial) {
    const action = text('action', 300) || 'catalog';
    if (!ACTION_RE.test(action)) throw new Error('Tugma harakati notoʻgʻri');
    out.action = action;
  }
  if (has('image') || !partial) {
    const image = text('image', 500);
    if (!/^(\/images\/[\w.-]+|https:\/\/\S+)$/.test(image)) throw new Error('Rasm manzili notoʻgʻri (https://… yoki /images/…)');
    out.image = image;
  }
  if (has('details')) out.details = String(body.details || '').trim().slice(0, 2000);
  if (has('i18n')) out.i18n = cleanI18n(body.i18n, ['kicker', 'title', 'subtitle', 'ctaLabel', 'details']);
  if (has('isActive')) out.isActive = Boolean(body.isActive);
  if (has('sortOrder')) out.sortOrder = Math.round(Number(body.sortOrder) || 0);
  return out;
}

function listBanners(req, res) {
  res.json(Banner.all());
}

async function createBanner(req, res) {
  try {
    let fields;
    try {
      fields = validateBanner(req.body || {}, { partial: false });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const banner = await Banner.create(fields);
    logger.info(`Admin ${req.user.telegram_id}: yangi banner #${banner.id}`);
    res.status(201).json(banner);
  } catch (err) {
    logger.error('POST /api/admin/banners xatosi', err);
    fail(res, 500, 'Bannerni qoʻshib boʻlmadi');
  }
}

async function updateBanner(req, res) {
  try {
    if (!Banner.findById(req.params.id)) return fail(res, 404, 'Banner topilmadi');
    let fields;
    try {
      fields = validateBanner(req.body || {}, { partial: true });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const banner = await Banner.update(req.params.id, fields);
    logger.info(`Admin ${req.user.telegram_id}: banner #${banner.id} yangilandi`);
    res.json(banner);
  } catch (err) {
    logger.error('PATCH /api/admin/banners xatosi', err);
    fail(res, 500, 'Bannerni saqlab boʻlmadi');
  }
}

// ---------- Xodimlar ----------
const STAFF_ROLES = ['manager', 'cook', 'courier'];

async function listStaff(req, res) {
  try {
    const rows = await User.listStaff();
    const owners = await Promise.all(config.adminIds.map((id) => User.findByTelegramId(id)));
    const staff = [
      ...owners.map((u, i) => ({
        telegramId: String(config.adminIds[i]),
        name: u ? u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') : 'Egasi',
        username: u?.username || '',
        phone: u?.phone || '',
        role: 'owner',
        roleTitle: ROLES.owner.title,
        editable: false,
      })),
      ...rows
        .filter((u) => !config.adminIds.includes(String(u.telegram_id)))
        .map((u) => ({
          telegramId: String(u.telegram_id),
          name: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Nomaʼlum',
          username: u.username || '',
          phone: u.phone || '',
          role: u.role,
          branchId: u.branch_id || null,
          roleTitle: ROLES[u.role]?.title || u.role,
          editable: true,
        })),
    ];
    res.json({
      staff,
      roles: STAFF_ROLES.map((r) => ({ id: r, title: ROLES[r].title, perms: ROLES[r].perms })),
    });
  } catch (err) {
    logger.error('GET /api/admin/staff xatosi', err);
    fail(res, 500, 'Xodimlarni yuklab boʻlmadi');
  }
}

async function createInvite(req, res) {
  try {
    const role = String(req.body?.role || '');
    if (!STAFF_ROLES.includes(role)) return fail(res, 400, 'Rol notoʻgʻri');
    const branchId = req.body?.branchId ? Number(req.body.branchId) : null;
    const branch = branchId ? Branch.findById(branchId) : null;
    if (branchId && !branch) return fail(res, 400, 'Filial topilmadi');
    const username = bot.isInited() ? bot.botInfo.username : '';
    if (!username) return fail(res, 503, 'Bot hali ishga tushmoqda — bir daqiqadan soʻng urinib koʻring');
    const token = await User.createInvite(role, req.user.telegram_id, 7, branchId);
    res.status(201).json({
      link: `https://t.me/${username}?start=staff_${token}`,
      role,
      roleTitle: ROLES[role].title,
      branchName: branch ? branch.name : 'Barcha filiallar',
      expiresInDays: 7,
    });
  } catch (err) {
    logger.error('POST /api/admin/staff/invites xatosi', err);
    fail(res, 500, 'Taklif havolasini yaratib boʻlmadi');
  }
}

async function updateStaff(req, res) {
  try {
    const telegramId = String(req.params.telegramId);
    if (config.adminIds.includes(telegramId)) return fail(res, 400, 'Egasining rolini oʻzgartirib boʻlmaydi');
    // Filialga biriktirish (null — barcha filiallar)
    if (req.body?.branchId !== undefined) {
      const bId = req.body.branchId === null || req.body.branchId === '' ? null : Number(req.body.branchId);
      if (bId !== null && !Branch.findById(bId)) return fail(res, 400, 'Filial topilmadi');
      const u = await User.setBranch(telegramId, bId);
      if (!u) return fail(res, 404, 'Foydalanuvchi topilmadi');
      if (req.body.role === undefined) return res.json({ telegramId, role: u.role, branchId: bId });
    }
    const role = String(req.body?.role || '');
    if (![...STAFF_ROLES, 'customer'].includes(role)) return fail(res, 400, 'Rol notoʻgʻri');
    const user = await User.setRole(telegramId, role);
    if (!user) return fail(res, 404, 'Foydalanuvchi topilmadi');
    logger.info(`Admin ${req.user.telegram_id}: ${telegramId} roli -> ${role}`);
    await bot.api
      .sendMessage(
        telegramId,
        role === 'customer' ? 'ℹ️ Siz jamoa roʻyxatidan chiqarildingiz.' : `ℹ️ Sizning rolingiz: ${ROLES[role].title}`
      )
      .catch(() => {});
    res.json({ telegramId, role, roleTitle: ROLES[role].title });
  } catch (err) {
    logger.error('PATCH /api/admin/staff xatosi', err);
    fail(res, 500, 'Rolni oʻzgartirib boʻlmadi');
  }
}

// ---------- Sozlamalar ----------
function getSettings(req, res) {
  res.json(Settings.get());
}

async function updateSettings(req, res) {
  try {
    const b = req.body || {};
    const out = {};
    if (b.coinsEnabled !== undefined) out.coinsEnabled = Boolean(b.coinsEnabled);
    if (b.coinsPerThousand !== undefined) {
      const v = Number(b.coinsPerThousand);
      if (!Number.isFinite(v) || v <= 0 || v > 1000) return fail(res, 400, 'Coin stavkasi 0.1 – 1000 oraligʻida boʻlsin');
      out.coinsPerThousand = Math.round(v * 10) / 10;
    }
    if (b.bannerInterval !== undefined) {
      const v = Math.round(Number(b.bannerInterval));
      if (!Number.isFinite(v) || v < 2 || v > 60) return fail(res, 400, 'Reklama vaqti 2 – 60 soniya oraligʻida boʻlsin');
      out.bannerInterval = v;
    }
    const s = await Settings.update(out);
    logger.info(`Admin ${req.user.telegram_id}: sozlamalar yangilandi ${JSON.stringify(out)}`);
    res.json(s);
  } catch (err) {
    logger.error('PATCH /api/admin/settings xatosi', err);
    fail(res, 500, 'Sozlamalarni saqlab boʻlmadi');
  }
}

// ---------- Filiallar ----------
const SHORT_LINK = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|yandex\.[a-z]+\/maps\/-\/)/i;

// Qisqa havolani (maps.app.goo.gl/...) to'liq havolaga ochadi
async function expandLink(url) {
  let current = url;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(current, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const next = r.headers.get('location');
    if (!next) {
      // Ba'zan koordinata sahifa ichida bo'ladi
      const body = await r.text().catch(() => '');
      const m = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(body) || /center=(-?\d{1,2}\.\d+)%2C(-?\d{1,3}\.\d+)/.exec(body);
      return m ? `${current}#@${m[1]},${m[2]}` : current;
    }
    current = new URL(next, current).toString();
  }
  return current;
}

/** Matn yoki xarita havolasidan koordinata: Google (to'liq/qisqa), Yandex, "41.31, 69.27" */
function coordsFromText(raw) {
  const text = decodeURIComponent(String(raw).replace(/\+/g, ' '));
  const isYandex = /yandex\./i.test(text);
  const pick = (re, swap = false) => {
    const m = re.exec(text);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return swap ? { lat: b, lng: a } : { lat: a, lng: b };
  };
  const num = '(-?\\d{1,3}\\.\\d+)';
  return (
    pick(new RegExp(`!3d${num}!4d${num}`)) || // Google aniq joy
    (isYandex && pick(new RegExp(`[?&](?:pt|ll|whatshere%5Bpoint%5D|whatshere\\[point\\])=${num},${num}`), true)) ||
    pick(new RegExp(`@${num},${num}`)) || // Google: /@41.3,69.2,15z
    pick(new RegExp(`[?&](?:q|query|ll|daddr|destination|center)=(?:loc:)?${num}\\s*,\\s*${num}`)) ||
    pick(new RegExp(`${num}\\s*,\\s*${num}`)) // oddiy "41.31, 69.27"
  );
}

async function parseCoords(body) {
  let lat = body.lat === '' || body.lat === null || body.lat === undefined ? null : Number(body.lat);
  let lng = body.lng === '' || body.lng === null || body.lng === undefined ? null : Number(body.lng);
  if (typeof body.coords === 'string' && body.coords.trim()) {
    let text = body.coords.trim();
    const urlMatch = /https?:\/\/\S+/.exec(text);
    if (urlMatch && SHORT_LINK.test(urlMatch[0])) {
      try {
        text = await expandLink(urlMatch[0]);
      } catch {
        throw new Error('Qisqa havolani ochib boʻlmadi. Xaritada joyni bosib turing va koordinatalarni nusxalang (masalan: 41.311, 69.279)');
      }
    }
    const c = coordsFromText(text);
    if (!c) {
      throw new Error('Havoladan koordinatani topib boʻlmadi. Xaritada joyni bosib turing va koordinatalarni nusxalang (masalan: 41.311, 69.279)');
    }
    ({ lat, lng } = c);
  }
  if (lat === null && lng === null) return { lat: null, lng: null };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('Koordinatalar notoʻgʻri');
  }
  return { lat, lng };
}

async function validateBranch(body, { partial }) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (has('name') || !partial) {
    const name = String(body.name || '').trim();
    if (name.length < 2 || name.length > 60) throw new Error('Filial nomi 2–60 belgi boʻlsin');
    out.name = name;
  }
  if (has('i18n')) out.i18n = cleanI18n(body.i18n, ['name']);
  if (has('address')) out.address = String(body.address || '').trim().slice(0, 300);
  if (has('phone')) out.phone = String(body.phone || '').trim().slice(0, 30);
  for (const k of ['openTime', 'closeTime']) {
    if (has(k)) {
      const v = String(body[k] || '').trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error('Ish vaqti HH:MM koʻrinishida boʻlsin');
      out[k] = v;
    }
  }
  if (has('radiusKm')) {
    const r = Number(body.radiusKm);
    if (!Number.isFinite(r) || r < 0.5 || r > 100) throw new Error('Yetkazish radiusi 0.5 – 100 km boʻlsin');
    out.radiusKm = r;
  }
  if (has('tables')) {
    const n = Math.round(Number(body.tables));
    if (!Number.isFinite(n) || n < 0 || n > 300) throw new Error('Stollar soni 0 – 300 boʻlsin');
    out.tables = n;
  }
  if (has('chatId')) {
    const c = String(body.chatId || '').trim();
    if (c && !/^-?\d{5,20}$/.test(c)) throw new Error('Chat ID raqam boʻlishi kerak (masalan -1001234567890)');
    out.chatId = c;
  }
  if (has('isActive')) out.isActive = Boolean(body.isActive);
  if (has('lat') || has('lng') || has('coords')) Object.assign(out, await parseCoords(body));
  return out;
}

// ---------- GET /api/qr/table/:branchId/:table.png — stol uchun QR (ommaviy: faqat bot havolasini kodlaydi) ----------
const QRCode = require('qrcode');

async function tableQr(req, res) {
  try {
    const branch = Branch.findById(req.params.branchId);
    const table = Math.floor(Number(req.params.table));
    const username = (bot.isInited() ? bot.botInfo.username : '');
    if (!branch || !username || !Number.isFinite(table) || table < 1 || table > Math.max(branch.tables, 1)) {
      return res.status(404).end();
    }
    const link = `https://t.me/${username}?start=table_${branch.id}_${table}`;
    const png = await QRCode.toBuffer(link, { width: 720, margin: 2, color: { dark: '#2a1a15', light: '#ffffff' } });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    if (req.query.download) res.set('Content-Disposition', `attachment; filename="stol-${branch.id}-${table}.png"`);
    res.send(png);
  } catch (err) {
    logger.error('QR xatosi', err);
    res.status(500).end();
  }
}

function listBranches(req, res) {
  res.json({ branches: Branch.all(), botUsername: (bot.isInited() ? bot.botInfo.username : '') || '' });
}

async function createBranch(req, res) {
  try {
    let fields;
    try {
      fields = await validateBranch(req.body || {}, { partial: false });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const b = await Branch.create(fields);
    logger.info(`Admin ${req.user.telegram_id}: yangi filial #${b.id} ${b.name}`);
    res.status(201).json(b);
  } catch (err) {
    logger.error('POST /api/admin/branches xatosi', err);
    fail(res, 500, 'Filialni saqlab boʻlmadi');
  }
}

async function updateBranch(req, res) {
  try {
    if (!Branch.findById(req.params.id)) return fail(res, 404, 'Filial topilmadi');
    let fields;
    try {
      fields = await validateBranch(req.body || {}, { partial: true });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    if (fields.isActive === false && Branch.active().length === 1 && Branch.findById(req.params.id).isActive) {
      return fail(res, 400, 'Kamida bitta filial faol boʻlishi kerak');
    }
    const b = await Branch.update(req.params.id, fields);
    logger.info(`Admin ${req.user.telegram_id}: filial #${b.id} yangilandi`);
    res.json(b);
  } catch (err) {
    logger.error('PATCH /api/admin/branches xatosi', err);
    fail(res, 500, 'Filialni saqlab boʻlmadi');
  }
}

// ---------- Kategoriyalar ----------
function validateCategory(body, { partial }) {
  const out = {};
  if (body.title !== undefined || !partial) {
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 40) throw new Error('Kategoriya nomi 2–40 belgi boʻlsin');
    out.title = title;
  }
  if (body.emoji !== undefined) {
    const emoji = String(body.emoji || '').trim();
    if (!emoji || [...emoji].length > 4) throw new Error('Bitta emoji tanlang');
    out.emoji = emoji;
  }
  if (body.i18n !== undefined) out.i18n = cleanI18n(body.i18n, ['title']);
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) out.sortOrder = Math.round(Number(body.sortOrder) || 0);
  return out;
}

function listCategories(req, res) {
  res.json(Category.all().map((c) => ({ ...c, products: Product.all().filter((p) => p.categories.includes(c.id)).length })));
}

async function createCategory(req, res) {
  try {
    let fields;
    try {
      fields = validateCategory(req.body || {}, { partial: false });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const c = await Category.create(fields);
    logger.info(`Admin ${req.user.telegram_id}: yangi kategoriya ${c.id}`);
    res.status(201).json(c);
  } catch (err) {
    logger.error('POST /api/admin/categories xatosi', err);
    fail(res, 500, 'Kategoriyani saqlab boʻlmadi');
  }
}

async function updateCategory(req, res) {
  try {
    if (!Category.findById(req.params.id)) return fail(res, 404, 'Kategoriya topilmadi');
    let fields;
    try {
      fields = validateCategory(req.body || {}, { partial: true });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const c = await Category.update(req.params.id, fields);
    logger.info(`Admin ${req.user.telegram_id}: kategoriya ${c.id} yangilandi`);
    res.json(c);
  } catch (err) {
    logger.error('PATCH /api/admin/categories xatosi', err);
    fail(res, 500, 'Kategoriyani saqlab boʻlmadi');
  }
}

async function deleteCategory(req, res) {
  try {
    if (!Category.findById(req.params.id)) return fail(res, 404, 'Kategoriya topilmadi');
    await Category.remove(req.params.id);
    await Product.reload(); // pitsalardagi kategoriya ro'yxati yangilandi
    logger.info(`Admin ${req.user.telegram_id}: kategoriya ${req.params.id} oʻchirildi`);
    res.json({ ok: true });
  } catch (err) {
    logger.error('DELETE /api/admin/categories xatosi', err);
    fail(res, 500, 'Kategoriyani oʻchirib boʻlmadi');
  }
}

// ---------- Storislar ----------
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_STORY_IMAGE = 450 * 1024; // base64 uzunligi
const MAX_PRODUCT_IMAGE = 450 * 1024;

function validateStory(body, { partial }) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  const text = (k, max) => String(body[k] ?? '').trim().slice(0, max);

  if (has('title') || !partial) {
    const title = text('title', 20);
    if (!title) throw new Error('Doira ostidagi qisqa nomni kiriting');
    out.title = title;
  }
  if (has('emoji')) {
    const e = text('emoji', 16);
    if (!e || [...e].length > 4) throw new Error('Bitta emoji tanlang');
    out.emoji = e;
  }
  if (has('type')) {
    if (!Story.TYPES.includes(body.type)) throw new Error('Storis turi notoʻgʻri');
    out.type = body.type;
  }
  if (has('gradient')) {
    const g = body.gradient;
    if (!Array.isArray(g) || g.length !== 2 || !g.every((c) => HEX.test(c))) throw new Error('Fon ranglari notoʻgʻri');
    out.gradient = g;
  }
  if (has('heading') || !partial) {
    const h = text('heading', 140);
    if (h.length < 2) throw new Error('Sarlavhani kiriting');
    out.heading = h;
  }
  if (has('text')) out.text = text('text', 300);
  if (has('rating')) {
    const r = body.rating === null || body.rating === '' ? null : Math.round(Number(body.rating));
    if (r !== null && (r < 1 || r > 5)) throw new Error('Reyting 1–5 boʻlsin');
    out.rating = r;
  }
  if (has('ctaLabel')) out.ctaLabel = text('ctaLabel', 24);
  if (has('ctaAction')) {
    const a = text('ctaAction', 300);
    if (a && (a === 'details' || !ACTION_RE.test(a))) throw new Error('Tugma harakati notoʻgʻri');
    out.ctaAction = a;
  }
  if (out.ctaAction && !(out.ctaLabel ?? body.ctaLabel)) throw new Error('Tugma matnini kiriting');
  if (has('image')) {
    const img = text('image', 500);
    if (img && !/^(\/images\/[\w./-]+|https:\/\/\S+)$/.test(img)) throw new Error('Rasm manzili notoʻgʻri');
    out.image = img;
    out.imageData = null; // tayyor rasm tanlansa — yuklangan rasm olib tashlanadi
  }
  if (has('imageUpload')) {
    const d = String(body.imageUpload || '');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d)) throw new Error('Rasm formati notoʻgʻri (JPEG, PNG yoki WebP)');
    if (d.length > MAX_STORY_IMAGE) throw new Error('Rasm juda katta');
    out.imageData = d;
    out.image = '';
  }
  if (has('i18n')) out.i18n = cleanI18n(body.i18n, ['title', 'heading', 'text', 'ctaLabel']);
  if (has('isActive')) out.isActive = Boolean(body.isActive);
  return out;
}

function listStories(req, res) {
  res.json(Story.all());
}

async function createStory(req, res) {
  try {
    let d;
    try {
      d = validateStory(req.body || {}, { partial: false });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const s = await Story.create(d);
    logger.info(`Admin ${req.user.telegram_id}: yangi storis #${s.id}`);
    res.status(201).json(s);
  } catch (err) {
    logger.error('POST /api/admin/stories xatosi', err);
    fail(res, 500, 'Storisni saqlab boʻlmadi');
  }
}

async function updateStory(req, res) {
  try {
    if (!Story.findById(req.params.id)) return fail(res, 404, 'Storis topilmadi');
    let d;
    try {
      d = validateStory(req.body || {}, { partial: true });
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const s = await Story.update(req.params.id, d);
    res.json(s);
  } catch (err) {
    logger.error('PATCH /api/admin/stories xatosi', err);
    fail(res, 500, 'Storisni saqlab boʻlmadi');
  }
}

async function reorderStories(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    const known = Story.all().map((s) => s.id);
    if (ids.length !== known.length || !ids.every((id) => known.includes(id))) return fail(res, 400, 'Tartib notoʻgʻri');
    await Story.reorder(ids);
    res.json(Story.all());
  } catch (err) {
    logger.error('POST /api/admin/stories/reorder xatosi', err);
    fail(res, 500, 'Tartibni saqlab boʻlmadi');
  }
}

async function deleteStory(req, res) {
  try {
    if (!(await Story.remove(req.params.id))) return fail(res, 404, 'Storis topilmadi');
    logger.info(`Admin ${req.user.telegram_id}: storis #${req.params.id} oʻchirildi`);
    res.json({ ok: true });
  } catch (err) {
    logger.error('DELETE /api/admin/stories xatosi', err);
    fail(res, 500, 'Storisni oʻchirib boʻlmadi');
  }
}

// Ommaviy: yuklangan storis rasmi
async function productImage(req, res) {
  try {
    const data = await Product.imageData(String(req.params.id));
    const m = data && /^data:(image\/[a-z]+);base64,(.+)$/.exec(data);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // manzilda ?v= bor
    res.send(Buffer.from(m[2], 'base64'));
  } catch (err) {
    logger.error('Mahsulot rasmi xatosi', err);
    res.status(500).end();
  }
}

async function storyImage(req, res) {
  try {
    const data = await Story.imageData(Number(req.params.id));
    const m = data && /^data:(image\/[a-z]+);base64,(.+)$/.exec(data);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // manzilda ?v= bor
    res.send(Buffer.from(m[2], 'base64'));
  } catch (err) {
    logger.error('Storis rasmi xatosi', err);
    res.status(500).end();
  }
}

async function deleteBranch(req, res) {
  try {
    const b = Branch.findById(req.params.id);
    if (!b) return fail(res, 404, 'Filial topilmadi');
    const othersActive = Branch.active().filter((x) => x.id !== b.id).length;
    if (othersActive === 0) {
      return fail(res, 400, 'Oxirgi faol filialni oʻchirib boʻlmaydi — avval boshqa filial qoʻshing yoki yoqing');
    }
    const r = await Branch.remove(b.id);
    logger.info(`Admin ${req.user.telegram_id}: filial #${b.id} ${b.name} oʻchirildi (${r.orders} ta eski buyurtma saqlandi)`);
    res.json({ ok: true, keptOrders: r.orders });
  } catch (err) {
    logger.error('DELETE /api/admin/branches xatosi', err);
    fail(res, 500, 'Filialni oʻchirib boʻlmadi');
  }
}

module.exports = {
  productImage,
  deleteBranch,
  listStories,
  createStory,
  updateStory,
  reorderStories,
  deleteStory,
  storyImage,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  tableQr,
  listBranches,
  createBranch,
  updateBranch,
  listStaff,
  createInvite,
  updateStaff,
  getSettings,
  updateSettings,
  getStats,
  listOrders,
  updateOrderStatus,
  listProducts,
  updateProduct,
  createProduct,
  listBanners,
  createBanner,
  updateBanner,
};
