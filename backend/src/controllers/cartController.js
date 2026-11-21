// Savat hisob-kitobi, buyurtma (yetkazish / zalda), filialga yo'naltirish, to'lovlar, coinlar va xabarlar
const config = require('../config/default');
const bot = require('../core/bot');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Banner = require('../models/Banner');
const Branch = require('../models/Branch');
const Category = require('../models/Category');
const Story = require('../models/Story');
const Settings = require('../models/Settings');
const Address = require('../models/Address');
const keyboards = require('../utils/keyboards');
const logger = require('../utils/logger');
const { t, fmtMoney, CONTENT, localize, normalizeLang } = require('../utils/i18n');
const { escapeHtml, normalizePhone } = require('./startController');

const PAYMENT_IDS = config.paymentMethods.map((m) => m.id);
const fmt = (n) => fmtMoney(n, 'uz');

function toStars(amountSum) {
  return Math.max(1, Math.ceil(amountSum / config.starsRate));
}

function mergeQty(list) {
  const merged = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const product = Product.findById(String(raw?.productId));
    const qty = Math.floor(Number(raw?.qty));
    if (!product || !product.isActive) throw new Error('Mahsulot topilmadi yoki vaqtincha mavjud emas');
    if (!Number.isFinite(qty) || qty < 1) throw new Error('Miqdor notoʻgʻri');
    merged.set(product.id, Math.min((merged.get(product.id) || 0) + qty, config.limits.maxQtyPerItem));
  }
  return merged;
}

/**
 * Narxlarni HAR DOIM serverda hisoblaymiz — mijozdan kelgan narxlarga ishonmaymiz.
 * Zalda (dinein) buyurtmada yetkazish puli olinmaydi.
 */
function calculateCart(items, bumpAdded, rewards = [], orderType = 'delivery') {
  const paid = mergeQty(items);
  const gifts = mergeQty(rewards);
  if (paid.size + gifts.size === 0) throw new Error('Savatcha boʻsh');
  if (paid.size + gifts.size > config.limits.maxLines) throw new Error('Savatchada juda koʻp mahsulot bor');

  const settings = Settings.get();
  if (gifts.size && !settings.coinsEnabled) throw new Error('Coin dasturi hozircha oʻchirilgan');

  const lines = [...paid.entries()].map(([id, qty]) => {
    const p = Product.findById(id);
    return { productId: p.id, name: p.name, qty, price: p.price, oldPrice: p.oldPrice, lineTotal: p.price * qty };
  });
  const rewardLines = [...gifts.entries()].map(([id, qty]) => {
    const p = Product.findById(id);
    if (!p.coinPrice) throw new Error(`${p.name} coinga sotilmaydi`);
    return { productId: p.id, name: p.name, qty, price: 0, oldPrice: 0, lineTotal: 0, reward: true, coinPrice: p.coinPrice };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const oldSubtotal = lines.reduce((s, l) => s + (l.oldPrice || l.price) * l.qty, 0);
  const coinsCost = rewardLines.reduce((s, l) => s + l.coinPrice * l.qty, 0);
  const withBump = Boolean(bumpAdded) && lines.length > 0;
  const bumpPrice = withBump ? config.orderBump.price : 0;
  const bumpSavings = withBump ? config.orderBump.oldPrice - config.orderBump.price : 0;
  const deliveryFee = orderType === 'dinein' || subtotal >= config.delivery.freeFrom ? 0 : config.delivery.fee;
  const total = subtotal + bumpPrice + deliveryFee;

  return {
    lines: [...lines, ...rewardLines],
    subtotal,
    savings: oldSubtotal - subtotal + bumpSavings,
    bumpAdded: withBump,
    bumpPrice,
    deliveryFee,
    total,
    totalStars: toStars(total),
    coinsCost,
  };
}

function paymentTitle(id, lang = 'uz') {
  const m = config.paymentMethods.find((x) => x.id === id);
  if (!m) return id;
  return (lang !== 'uz' && CONTENT.paymentMethods[id]?.[lang]?.title) || m.title;
}

function mapLink(order) {
  if (order.lat === null || order.lat === undefined) return '';
  return `https://maps.google.com/?q=${order.lat},${order.lng}`;
}

function branchName(branch) {
  return branch ? branch.name : '—';
}

function orderChatId(order) {
  const b = order.branch_id ? Branch.findById(order.branch_id) : null;
  return b?.chatId || config.adminChatId;
}

function formatOrderMessage(order, user) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const tgLink = `<a href="tg://user?id=${order.telegram_id}">${escapeHtml(order.customer_name)}</a>`;
  const username = user?.username ? ` (@${escapeHtml(user.username)})` : '';
  const branch = order.branch_id ? Branch.findById(order.branch_id) : null;
  const dinein = order.order_type === 'dinein';

  const itemLines = items
    .map((l, i) =>
      l.reward
        ? `${i + 1}. 🎁 ${escapeHtml(l.name)} × ${l.qty} = <b>${l.coinPrice * l.qty} coin</b>`
        : `${i + 1}. ${escapeHtml(l.name)} × ${l.qty} = <b>${fmt(l.lineTotal)}</b>`
    )
    .join('\n');

  const lines = [
    `${dinein ? '🍽' : '🛵'} <b>${dinein ? 'ZALDA' : 'YETKAZISH'} · BUYURTMA #${order.id}</b>`,
    `🏪 <b>Filial:</b> ${escapeHtml(branchName(branch))}`,
    '',
    `👤 <b>Mijoz:</b> ${tgLink}${username}`,
    `📞 <b>Telefon:</b> ${escapeHtml(order.phone)}`,
  ];
  if (dinein) lines.push(`🪑 <b>Stol:</b> ${escapeHtml(order.table_no || '—')}`);
  else {
    lines.push(`📍 <b>Manzil:</b> ${escapeHtml(order.address)}`);
    const map = mapLink(order);
    if (map) lines.push(`🗺 <a href="${map}">Xaritada ochish</a>`);
  }
  if (order.comment) lines.push(`💬 <b>Izoh:</b> ${escapeHtml(order.comment)}`);

  lines.push('', '<b>🛒 Tarkibi:</b>', itemLines);
  if (order.bump_added) lines.push(`➕ ${escapeHtml(config.orderBump.title)} = <b>${fmt(order.bump_price)}</b>`);

  lines.push('', `Mahsulotlar: ${fmt(order.subtotal)}`);
  if (!dinein) lines.push(`Yetkazish: ${order.delivery_fee ? fmt(order.delivery_fee) : 'bepul'}`);
  if (order.coins_spent) lines.push(`🪙 Coin bilan toʻlandi: ${order.coins_spent} coin`);
  lines.push(
    `💰 <b>JAMI: ${fmt(order.total)}</b>` + (order.payment_method === 'stars' ? ` (${order.total_stars} ⭐️)` : ''),
    '',
    `💳 <b>Toʻlov:</b> ${escapeHtml(paymentTitle(order.payment_method))} — ${
      Order.PAYMENT_STATUSES[order.payment_status] || order.payment_status
    }`,
    `📦 <b>Holat:</b> ${Order.STATUSES[order.status] || order.status}`,
    `🌐 Til: ${order.lang || 'uz'} · 🕒 ${new Date(order.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`
  );
  return lines.join('\n');
}

async function notifyAdmin(order) {
  try {
    const user = await User.findByTelegramId(order.telegram_id);
    const msg = await bot.api.sendMessage(orderChatId(order), formatOrderMessage(order, user), {
      parse_mode: 'HTML',
      reply_markup: keyboards.adminOrderKeyboard(order),
      link_preview_options: { is_disabled: true },
    });
    await Order.setAdminMessage(order.id, msg.message_id);
  } catch (err) {
    logger.error(`Filial chatiga #${order.id} buyurtmani yuborib boʻlmadi (chat ID ni tekshiring)`, err);
  }
}

// Xodimlarga (rol va filial bo'yicha) shaxsiy xabar
async function notifyStaff(roles, text, branchId) {
  try {
    const staff = await User.staffByRoles(roles, branchId || null);
    for (const s of staff) {
      if (String(s.telegram_id) === String(config.adminChatId)) continue; // admin chatga allaqachon yuborilgan
      await bot.api
        .sendMessage(s.telegram_id, text, { parse_mode: 'HTML', reply_markup: keyboards.panelButton(), link_preview_options: { is_disabled: true } })
        .catch((e) => logger.warn(`Xodimga (${s.telegram_id}) xabar yuborilmadi: ${e.description || e.message}`));
    }
  } catch (err) {
    logger.error('Xodimlarga xabar yuborishda xato', err);
  }
}

function shortOrder(order) {
  const items = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items)
    .map((l) => `${l.reward ? '🎁 ' : ''}${escapeHtml(l.name)} × ${l.qty}`)
    .join(', ');
  const branch = order.branch_id ? Branch.findById(order.branch_id) : null;
  const where = order.order_type === 'dinein' ? `🍽 ${order.table_no}-stol` : `📍 ${escapeHtml(order.address)}`;
  return `<b>#${order.id}</b> · 🏪 ${escapeHtml(branchName(branch))}\n${items}\n${where}\n📞 ${escapeHtml(order.phone)}`;
}

async function notifyCustomer(order, text) {
  try {
    await bot.api.sendMessage(order.telegram_id, text, {
      parse_mode: 'HTML',
      reply_markup: keyboards.orderStatusKeyboard(order.lang),
    });
  } catch (err) {
    logger.warn(`Mijozga (#${order.id}) xabar yuborilmadi: ${err.description || err.message}`);
  }
}

async function createInvoiceLink(order) {
  const title = `Buyurtma #${order.id}`;
  const description = `${config.brand.name}: ${fmt(order.total)}`;
  const payload = `order:${order.id}`;
  if (order.payment_method === 'stars') {
    return bot.api.createInvoiceLink(title, description, payload, '', 'XTR', [{ label: title, amount: order.total_stars }]);
  }
  return bot.api.createInvoiceLink(title, description, payload, config.paymentProviderToken, config.currency, [
    { label: title, amount: order.total * 100 },
  ]);
}

async function chargeCoins(order) {
  if (!order.coins_spent || order.coins_charged) return true;
  const balance = await User.addCoins(order.telegram_id, -order.coins_spent, 'spend', order.id, `Buyurtma #${order.id}`);
  if (balance === null) return false;
  await Order.patch(order.id, { coins_charged: true });
  order.coins_charged = true;
  return true;
}

async function announceNewOrder(order) {
  await notifyAdmin(order);
  await notifyStaff(['manager', 'cook'], `🆕 <b>Yangi buyurtma</b>\n\n${shortOrder(order)}`, order.branch_id);
}

// ---------- API: GET /api/catalog?lang= ----------
function getCatalog(req, res) {
  const lang = normalizeLang(req.query.lang);
  const s = Settings.get();
  const brand = lang === 'uz' ? config.brand : { ...config.brand, ...CONTENT.brand[lang] };
  const pick = (map, key, field, fallback) => (lang !== 'uz' && map[key]?.[lang]?.[field]) || fallback;

  res.json({
    lang,
    brand,
    categories: [
      { id: 'all', emoji: '🍕', title: (lang !== 'uz' && CONTENT.categories.all?.[lang]) || 'Barchasi' },
      ...Category.active().map((c) => {
        const l = localize(c, lang, ['title']);
        return { id: c.id, emoji: c.emoji, title: l.title };
      }),
    ],
    products: Product.active().map((p) => localize(p, lang, ['name', 'description', 'ingredients'])),
    banners: Banner.active().map((b) => localize(b, lang, ['kicker', 'title', 'subtitle', 'ctaLabel', 'details'])),
    stories: Story.active().map((st) => {
      const l = localize(st, lang, ['title', 'heading', 'text', 'ctaLabel']);
      return {
        id: String(st.id),
        title: l.title,
        emoji: st.emoji,
        type: st.type,
        gradient: st.gradient,
        heading: l.heading,
        text: l.text,
        rating: st.rating || undefined,
        image: st.image || undefined,
        cta: st.ctaAction ? { label: l.ctaLabel || st.ctaLabel, action: st.ctaAction } : undefined,
      };
    }),
    orderBump: lang === 'uz' ? config.orderBump : { ...config.orderBump, ...CONTENT.orderBump[lang] },
    delivery: config.delivery,
    starsRate: config.starsRate,
    supportUsername: config.supportUsername,
    settings: { coinsEnabled: s.coinsEnabled, coinsPerThousand: s.coinsPerThousand, bannerInterval: s.bannerInterval },
    branches: Branch.active().map((b) => {
      const l = localize(b, lang, ['name']);
      return { id: b.id, name: l.name, address: b.address, lat: b.lat, lng: b.lng, phone: b.phone, openTime: b.openTime, closeTime: b.closeTime, tables: b.tables };
    }),
    paymentMethods: config.paymentMethods.map((m) => ({
      ...m,
      title: pick(CONTENT.paymentMethods, m.id, 'title', m.title),
      subtitle: pick(CONTENT.paymentMethods, m.id, 'subtitle', m.subtitle),
      enabled: m.id === 'provider' ? Boolean(config.paymentProviderToken) : true,
    })),
  });
}

// ---------- API: POST /api/branches/detect — mijoz filial ichidami? ----------
const DINE_IN_RADIUS_KM = 0.15;

function detectBranch(req, res) {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Koordinatalar notoʻgʻri' });
  const n = Branch.nearest(lat, lng);
  if (!n || n.distanceKm === null) return res.json({ branchId: null, inside: false });
  res.json({ branchId: n.branch.id, distanceKm: Math.round(n.distanceKm * 1000) / 1000, inside: n.distanceKm <= DINE_IN_RADIUS_KM });
}

// ---------- API: POST /api/orders ----------
async function createOrder(req, res) {
  const body = req.body || {};
  const tgId = req.user.telegram_id;
  const lang = normalizeLang(req.user.lang || req.user.language_code);
  try {
    const customerName = String(body.fullName || '').trim().slice(0, 120);
    const phone = normalizePhone(body.phone);
    const comment = String(body.comment || '').trim().slice(0, 500);
    const paymentMethod = String(body.paymentMethod || '');
    const orderType = body.orderType === 'dinein' ? 'dinein' : 'delivery';

    if (customerName.length < 3) return res.status(400).json({ error: 'Ism-familiyani toʻliq kiriting' });
    if (!phone) return res.status(400).json({ error: 'Telefon raqam notoʻgʻri' });
    if (!PAYMENT_IDS.includes(paymentMethod)) return res.status(400).json({ error: 'Toʻlov usulini tanlang' });
    if (paymentMethod === 'provider' && !config.paymentProviderToken) {
      return res.status(400).json({ error: 'Click/Payme hozircha ulanmagan. Boshqa usulni tanlang.' });
    }

    let address = '';
    let lat = null;
    let lng = null;
    let branch = null;
    let tableNo = null;

    if (orderType === 'dinein') {
      branch = Branch.findById(body.branchId);
      if (!branch || !branch.isActive) return res.status(400).json({ error: 'Filial topilmadi' });
      const table = Math.floor(Number(body.tableNo));
      if (!Number.isFinite(table) || table < 1 || table > Math.max(branch.tables, 1)) {
        return res.status(400).json({ error: `Stol raqamini kiriting (1–${branch.tables})` });
      }
      tableNo = String(table);
      address = `Zal: ${branch.name}, ${tableNo}-stol`;
    } else {
      if (body.addressId) {
        const saved = await Address.findOne(tgId, Number(body.addressId));
        if (!saved) return res.status(400).json({ error: 'Manzil topilmadi' });
        address = Address.formatAddress(saved);
        lat = saved.lat;
        lng = saved.lng;
      } else {
        address = String(body.address || '').trim().slice(0, 500);
      }
      if (address.length < 5) return res.status(400).json({ error: 'Yetkazish manzilini kiriting' });

      // Eng yaqin filial
      const near = Branch.nearest(lat, lng);
      if (!near) return res.status(400).json({ error: 'Hozircha ishlayotgan filial yoʻq' });
      if (!near.inRadius) {
        return res.status(400).json({
          error: `Manzilingiz yetkazish hududidan tashqarida (eng yaqin filial ${near.distanceKm.toFixed(1)} km uzoqlikda)`,
        });
      }
      branch = near.branch;
    }

    let cart;
    try {
      cart = calculateCart(body.items, Boolean(body.bumpAdded), body.rewards, orderType);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    if (cart.coinsCost > (req.user.coins || 0)) {
      return res.status(400).json({ error: `Coin yetarli emas: kerak ${cart.coinsCost}, sizda ${req.user.coins || 0}` });
    }

    const online = paymentMethod === 'stars' || paymentMethod === 'provider';
    const paymentStatus = online ? 'pending' : paymentMethod === 'crypto' ? 'manual' : 'on_delivery';

    await User.updateContact(tgId, { fullName: customerName, phone });

    const order = await Order.create({
      userId: req.user.id,
      telegramId: tgId,
      customerName,
      phone,
      address,
      comment,
      items: cart.lines,
      bumpAdded: cart.bumpAdded,
      bumpPrice: cart.bumpPrice,
      subtotal: cart.subtotal,
      savings: cart.savings,
      deliveryFee: cart.deliveryFee,
      total: cart.total,
      totalStars: cart.totalStars,
      paymentMethod,
      paymentStatus,
      coinsSpent: cart.coinsCost,
      lat,
      lng,
      branchId: branch.id,
      orderType,
      tableNo,
      lang,
    });

    const branchOut = { id: branch.id, name: localize(branch, lang, ['name']).name };

    if (online) {
      const invoiceLink = await createInvoiceLink(order);
      return res.status(201).json({ orderId: order.id, total: order.total, totalStars: order.total_stars, invoiceLink, branch: branchOut });
    }

    if (!(await chargeCoins(order))) {
      await Order.setStatus(order.id, 'cancelled');
      return res.status(400).json({ error: 'Coin yetarli emas' });
    }
    await announceNewOrder(order);

    let text =
      `${t(lang, 'orderAccepted', { id: order.id })}\n\n` +
      `🏪 ${escapeHtml(branchOut.name)}\n` +
      `${t(lang, 'total')}: <b>${fmtMoney(order.total, lang)}</b>\n` +
      (order.coins_spent ? `${t(lang, 'withCoins', { coins: order.coins_spent })}\n` : '') +
      `${t(lang, 'payment')}: ${escapeHtml(paymentTitle(order.payment_method, lang))}\n\n` +
      (orderType === 'dinein' ? t(lang, 'dineInSoon', { table: tableNo }) : t(lang, 'operatorSoon'));
    if (paymentMethod === 'crypto' && config.cryptoWallet) text += `\n\n${t(lang, 'cryptoWallet', { wallet: escapeHtml(config.cryptoWallet) })}`;
    await notifyCustomer(order, text);

    return res.status(201).json({ orderId: order.id, total: order.total, totalStars: order.total_stars, branch: branchOut });
  } catch (err) {
    logger.error('POST /api/orders xatosi', err);
    return res.status(500).json({ error: 'Buyurtmani saqlab boʻlmadi. Qaytadan urinib koʻring.' });
  }
}

// ---------- API: GET /api/orders ----------
async function getMyOrders(req, res) {
  try {
    const orders = await Order.listByTelegramId(req.user.telegram_id, 20);
    res.json(
      orders
        .filter((o) => o.payment_status !== 'pending')
        .map((o) => ({
          id: o.id,
          total: o.total,
          status: o.status,
          statusTitle: Order.STATUSES[o.status],
          orderType: o.order_type,
          tableNo: o.table_no,
          branchName: o.branch_id ? Branch.findById(o.branch_id)?.name || '' : '',
          paymentMethod: o.payment_method,
          paymentStatus: o.payment_status,
          paymentStatusTitle: Order.PAYMENT_STATUSES[o.payment_status],
          items: o.items,
          coinsSpent: o.coins_spent,
          coinsEarned: o.coins_earned,
          createdAt: o.created_at,
        }))
    );
  } catch (err) {
    logger.error('GET /api/orders xatosi', err);
    res.status(500).json({ error: 'Buyurtmalarni yuklab boʻlmadi' });
  }
}

// ---------- BOT: to'lovlar ----------
function orderIdFromPayload(payload) {
  const m = /^order:(\d+)$/.exec(payload || '');
  return m ? Number(m[1]) : null;
}

async function handlePreCheckout(ctx) {
  const q = ctx.preCheckoutQuery;
  const order = await Order.findById(orderIdFromPayload(q.invoice_payload));
  if (!order || order.telegram_id !== String(q.from.id)) {
    return ctx.answerPreCheckoutQuery(false, { error_message: 'Buyurtma topilmadi. Qaytadan urinib koʻring.' });
  }
  if (order.payment_status === 'paid') {
    return ctx.answerPreCheckoutQuery(false, { error_message: 'Bu buyurtma allaqachon toʻlangan.' });
  }
  const expected = q.currency === 'XTR' ? order.total_stars : order.total * 100;
  if (q.total_amount !== expected) {
    return ctx.answerPreCheckoutQuery(false, { error_message: 'Summa mos kelmadi. Buyurtmani qayta rasmiylashtiring.' });
  }
  if (order.coins_spent) {
    const user = await User.findByTelegramId(order.telegram_id);
    if ((user?.coins || 0) < order.coins_spent) {
      return ctx.answerPreCheckoutQuery(false, { error_message: 'Coin yetarli emas. Savatchani yangilang.' });
    }
  }
  return ctx.answerPreCheckoutQuery(true);
}

async function handleSuccessfulPayment(ctx) {
  const payment = ctx.message.successful_payment;
  const orderId = orderIdFromPayload(payment.invoice_payload);
  const order = orderId && (await Order.markPaid(orderId, payment.telegram_payment_charge_id));
  if (!order) {
    logger.error(`Toʻlov keldi, lekin buyurtma topilmadi: ${payment.invoice_payload}`);
    return;
  }
  if (!(await chargeCoins(order))) logger.warn(`#${order.id}: toʻlovdan keyin coin yetmadi — admin tekshirsin`);
  await announceNewOrder(order);
  await ctx.reply(t(order.lang, 'paid', { id: order.id }), { parse_mode: 'HTML' });
}

// ---------- Holatni o'zgartirish ----------
async function changeOrderStatus(orderId, status) {
  if (!Order.STATUSES[status]) throw new Error('Notoʻgʻri status');
  let order = await Order.setStatus(orderId, status);
  if (!order) return null;
  const lang = order.lang || 'uz';
  const dinein = order.order_type === 'dinein';

  let extra = '';
  if (status === 'cancelled' && order.coins_charged) {
    await User.addCoins(order.telegram_id, order.coins_spent, 'refund', order.id, `#${order.id} bekor qilindi`);
    order = await Order.patch(order.id, { coins_charged: false });
    extra = `\n${t(lang, 'coinsRefund', { coins: order.coins_spent })}`;
  }
  const s = Settings.get();
  if (status === 'done' && s.coinsEnabled && !order.coins_earned) {
    const earn = Math.floor((order.subtotal / 1000) * s.coinsPerThousand);
    if (earn > 0) {
      const balance = await User.addCoins(order.telegram_id, earn, 'earn', order.id, `Buyurtma #${order.id}`);
      order = await Order.patch(order.id, { coins_earned: earn });
      extra = `\n\n${t(lang, 'coinsEarned', { coins: earn, balance })}`;
    }
  }

  if (order.admin_message_id) {
    try {
      const user = await User.findByTelegramId(order.telegram_id);
      await bot.api.editMessageText(orderChatId(order), Number(order.admin_message_id), formatOrderMessage(order, user), {
        parse_mode: 'HTML',
        reply_markup: keyboards.adminOrderKeyboard(order),
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      if (!String(err.description || '').includes('not modified')) {
        logger.warn(`Buyurtma kartasini (#${order.id}) yangilab boʻlmadi: ${err.description || err.message}`);
      }
    }
  }
  if (status === 'ready' && !dinein) {
    await notifyStaff(['courier'], `📦 <b>Olib ketishga tayyor</b>\n\n${shortOrder(order)}`, order.branch_id);
  }
  const key = dinein && (status === 'ready' || status === 'done') ? `st_${status}_dinein` : `st_${status}`;
  await notifyCustomer(order, t(lang, key, { id: order.id }) + extra);
  return order;
}

async function handleAdminStatus(ctx) {
  const chatId = String(ctx.chat?.id);
  const allowedChats = [String(config.adminChatId), ...Branch.all().map((b) => String(b.chatId)).filter(Boolean)];
  if (!allowedChats.includes(chatId)) return ctx.answerCallbackQuery({ text: 'Ruxsat yoʻq', show_alert: true });
  const [, idStr, status] = ctx.callbackQuery.data.split(':');
  const order = await changeOrderStatus(Number(idStr), status);
  if (!order) return ctx.answerCallbackQuery({ text: 'Buyurtma topilmadi', show_alert: true });
  await ctx.answerCallbackQuery({ text: Order.STATUSES[status] });
}

module.exports = {
  calculateCart,
  changeOrderStatus,
  paymentTitle,
  mapLink,
  formatOrderMessage,
  getCatalog,
  detectBranch,
  createOrder,
  getMyOrders,
  handlePreCheckout,
  handleSuccessfulPayment,
  handleAdminStatus,
};
