// Foydalanuvchini bazadan tekshirish:
//  - botAuth: har bir bot update'ida foydalanuvchini bazaga yozadi / yangilaydi
//  - apiAuth: Mini App so'rovlaridagi Telegram initData imzosini tekshiradi
const crypto = require('crypto');
const config = require('../config/default');
const User = require('../models/User');
const logger = require('../utils/logger');

const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

/**
 * Telegram WebApp initData ni tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * @returns {object|null} Telegram user obyekti yoki null
 */
function validateInitData(initData, botToken = config.botToken) {
  if (!initData || typeof initData !== 'string') return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_SEC) return null;

  try {
    const user = JSON.parse(params.get('user') || 'null');
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

// grammY middleware
async function botAuth(ctx, next) {
  if (ctx.from && !ctx.from.is_bot) {
    try {
      ctx.dbUser = await User.upsertFromTelegram(ctx.from);
    } catch (err) {
      logger.error('Bot: foydalanuvchini bazaga yozib boʻlmadi', err);
    }
  }
  return next();
}

const DEV_USER = { id: 1, first_name: 'Test', last_name: 'Foydalanuvchi', username: 'dev_user' };

// Express middleware
async function apiAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const initData = header.startsWith('tma ') ? header.slice(4) : '';

    let tgUser = validateInitData(initData);
    if (!tgUser && config.devSkipAuth && !initData) {
      tgUser = DEV_USER;
    }
    if (!tgUser) {
      return res.status(401).json({ error: 'Avtorizatsiya xatosi. Ilovani Telegram ichidan oching.' });
    }

    req.tgUser = tgUser;
    req.user = await User.upsertCached(tgUser);
    return next();
  } catch (err) {
    logger.error('API auth xatosi', err);
    return res.status(500).json({ error: 'Server xatosi. Birozdan soʻng urinib koʻring.' });
  }
}

// ---------- Rollar va ruxsatlar ----------
const ROLES = {
  owner: { title: '👑 Egasi', perms: ['orders', 'stats', 'menu', 'ads', 'branches', 'staff', 'settings'] },
  manager: { title: '🧑‍💼 Menejer', perms: ['orders', 'stats', 'menu', 'ads'] },
  cook: { title: '👨‍🍳 Oshpaz', perms: ['orders'] },
  courier: { title: '🛵 Kuryer', perms: ['orders'] },
  customer: { title: 'Mijoz', perms: [] },
};

// Kim qaysi holatdan qaysi holatga o'tkaza oladi
const FULL_FLOW = {
  new: ['accepted', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  ready: ['delivering', 'cancelled'],
  delivering: ['done', 'cancelled'],
};
const TRANSITIONS = {
  owner: FULL_FLOW,
  manager: FULL_FLOW,
  cook: { new: ['accepted'], accepted: ['ready'] },
  courier: { ready: ['delivering'], delivering: ['done'] },
  customer: {},
};

// Rolga qarab ko'rinadigan buyurtma holatlari (null — hammasi)
const VISIBLE_STATUSES = {
  owner: null,
  manager: null,
  cook: ['new', 'accepted', 'ready'],
  courier: ['ready', 'delivering', 'done'],
  customer: [],
};

function getRole(user) {
  if (!user) return 'customer';
  if (config.adminIds.includes(String(user.telegram_id ?? user.id))) return 'owner';
  return ROLES[user.role] ? user.role : 'customer';
}

function isAdmin(telegramId) {
  return config.adminIds.includes(String(telegramId));
}

function hasPerm(role, perm) {
  return (ROLES[role]?.perms || []).includes(perm);
}

// Buyurtma turiga qarab ruxsat etilgan keyingi holatlar
function transitionsFor(role, order) {
  const base = TRANSITIONS[role]?.[order.status] || [];
  if (order.order_type !== 'dinein') return base;
  if (role === 'courier') return []; // zal buyurtmalari kuryerga tegishli emas
  if (order.status === 'ready') return role === 'cook' ? ['done'] : ['done', 'cancelled'];
  return base.filter((s) => s !== 'delivering');
}

function canTransition(role, order, to) {
  return transitionsFor(role, order).includes(to);
}

// Express middleware: ruxsat tekshiruvi (apiAuth dan keyin)
function requirePerm(perm) {
  return (req, res, next) => {
    const role = getRole(req.user);
    if (!hasPerm(role, perm)) return res.status(403).json({ error: 'Bu boʻlimga ruxsatingiz yoʻq' });
    req.role = role;
    return next();
  };
}

// Panelga umuman kira oladimi (har qanday xodim)
function staffOnly(req, res, next) {
  const role = getRole(req.user);
  if (role === 'customer') return res.status(403).json({ error: 'Bu boʻlim faqat xodimlar uchun' });
  req.role = role;
  return next();
}

module.exports = {
  validateInitData,
  botAuth,
  apiAuth,
  isAdmin,
  ROLES,
  TRANSITIONS,
  VISIBLE_STATUSES,
  getRole,
  hasPerm,
  canTransition,
  transitionsFor,
  requirePerm,
  staffOnly,
};
