// /start, /help, kontakt va profil logikasi
const config = require('../config/default');
const User = require('../models/User');
const Order = require('../models/Order');
const keyboards = require('../utils/keyboards');
const { getRole, ROLES } = require('../middlewares/auth.middleware');
const Settings = require('../models/Settings');
const Branch = require('../models/Branch');
const logger = require('../utils/logger');
const { t, fmtMoney, normalizeLang, localize } = require('../utils/i18n');

const langOf = (ctx) => normalizeLang(ctx.dbUser?.lang || ctx.from?.language_code);

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Telefon raqamni +998XXXXXXXXX ko'rinishiga keltiradi
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

async function handleStart(ctx) {
  // Xodim taklif havolasi: /start staff_<token>
  const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';
  if (payload.startsWith('staff_')) {
    const invite = await User.useInvite(payload.slice(6), ctx.from.id);
    const role = invite?.role;
    const branchName = invite?.branchId ? Branch.findById(invite.branchId)?.name || '' : 'Barcha filiallar';
    if (!role) {
      await ctx.reply('⚠️ Taklif havolasi eskirgan yoki allaqachon ishlatilgan. Admindan yangisini soʻrang.');
      return;
    }
    await ctx.reply(
      `🎉 Siz jamoaga <b>${escapeHtml(ROLES[role].title)}</b> sifatida qoʻshildingiz!\n🏪 Filial: <b>${escapeHtml(branchName)}</b>\n\n` +
        'Buyurtmalar shu chatga keladi. Panelni /admin buyrugʻi yoki quyidagi tugma orqali ochasiz.',
      { parse_mode: 'HTML', reply_markup: keyboards.webAppAvailable() ? keyboards.adminPanel() : undefined }
    );
    for (const ownerId of config.adminIds) {
      await ctx.api
        .sendMessage(ownerId, `👥 Yangi xodim: ${escapeHtml(ctx.from.first_name || '')} — ${ROLES[role].title} · 🏪 ${escapeHtml(branchName)}`, { parse_mode: 'HTML' })
        .catch(() => {});
    }
    return;
  }

  const lang = langOf(ctx);

  // Stoldagi QR kod: /start table_<filialId>_<stol>
  const table = /^table_(\d+)_(\d+)$/.exec(payload);
  if (table && keyboards.webAppAvailable()) {
    const branch = Branch.findById(table[1]);
    if (branch && branch.isActive) {
      const name = localize(branch, lang, ['name']).name;
      await ctx.reply(t(lang, 'dineIn', { branch: escapeHtml(name), table: table[2] }), {
        parse_mode: 'HTML',
        reply_markup: keyboards.dineInMenu(lang, branch.id, table[2]),
      });
      return;
    }
  }

  const name = escapeHtml(ctx.from?.first_name || '');
  const lines = [
    t(lang, 'hello', { name }),
    '',
    `<b>${escapeHtml(config.brand.name)}</b>`,
    '',
    t(lang, 'promo1'),
    t(lang, 'promo2'),
    t(lang, 'promo3'),
    '',
    keyboards.webAppAvailable() ? t(lang, 'openHint') : t(lang, 'noWebApp'),
  ];
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: keyboards.mainMenu(lang) });
}

// /lang — til tanlash
async function handleLangCommand(ctx) {
  await ctx.reply(t(langOf(ctx), 'langPrompt'), { reply_markup: keyboards.langKeyboard() });
}

async function handleLangCallback(ctx) {
  const lang = normalizeLang(ctx.callbackQuery.data.split(':')[1]);
  await User.setLang(ctx.from.id, lang);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t(lang, 'langSet')).catch(() => {});
  await ctx.reply(t(lang, 'openHint'), { reply_markup: keyboards.mainMenu(lang) });
}

async function handleHelp(ctx) {
  const lang = langOf(ctx);
  const support = config.supportUsername ? `\n💬 @${escapeHtml(config.supportUsername)}` : '';
  await ctx.reply([t(lang, 'helpTitle'), t(lang, 'help1'), t(lang, 'help2'), t(lang, 'help3'), support, '', t(lang, 'helpCmds')].join('\n'), {
    parse_mode: 'HTML',
    reply_markup: keyboards.mainMenu(lang),
  });
}

async function handlePhoneCommand(ctx) {
  const lang = langOf(ctx);
  await ctx.reply(t(lang, 'phonePrompt'), { reply_markup: keyboards.contactRequest(lang) });
}

// Foydalanuvchi chatda kontakt yuborganda (yoki Mini App dagi requestContact orqali)
async function handleContact(ctx) {
  const contact = ctx.message.contact;
  const lang = langOf(ctx);
  if (!contact || contact.user_id !== ctx.from.id) {
    await ctx.reply(t(lang, 'phoneOwn'));
    return;
  }
  const phone = normalizePhone(contact.phone_number);
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  await User.updateContact(ctx.from.id, { phone, fullName: ctx.dbUser?.full_name ? null : fullName });
  await ctx.reply(t(lang, 'phoneSaved', { phone }), { reply_markup: keyboards.removeKeyboard() });
}

async function handleOrdersCommand(ctx) {
  const lang = langOf(ctx);
  const orders = (await Order.listByTelegramId(ctx.from.id, 5)).filter((o) => o.payment_status !== 'pending');
  if (!orders.length) {
    await ctx.reply(t(lang, 'noOrders'), { reply_markup: keyboards.mainMenu(lang) });
    return;
  }
  const text = orders
    .map((o) => `<b>#${o.id}</b> — ${fmtMoney(o.total, lang)}\n${Order.STATUSES[o.status] || o.status}`)
    .join('\n\n');
  await ctx.reply(`${t(lang, 'lastOrders')}\n\n${text}`, { parse_mode: 'HTML' });
}

async function handleAdminCommand(ctx) {
  const role = getRole(ctx.dbUser || { telegram_id: ctx.from.id });
  if (role === 'customer') {
    await ctx.reply('Bu buyruq faqat xodimlar uchun.');
    return;
  }
  if (!keyboards.webAppAvailable()) {
    await ctx.reply('⚠️ WEBAPP_URL sozlanmagan — admin panelni ochib boʻlmaydi.');
    return;
  }
  await ctx.reply(`🛠 <b>Panel</b> — ${escapeHtml(ROLES[role].title)}\n\nBuyurtmalar va boshqaruv shu yerda.`, {
    parse_mode: 'HTML',
    reply_markup: keyboards.adminPanel(),
  });
}

// ---------- API: GET /api/me ----------
async function getMe(req, res) {
  try {
    const ordersCount = await Order.countByTelegramId(req.user.telegram_id);
    const role = getRole(req.user);
    const tg = req.tgUser;
    res.json({
      id: req.user.telegram_id,
      firstName: tg.first_name || '',
      lastName: tg.last_name || '',
      username: tg.username || '',
      photoUrl: tg.photo_url || '',
      fullName: req.user.full_name || [tg.first_name, tg.last_name].filter(Boolean).join(' '),
      phone: req.user.phone || '',
      ordersCount,
      memberSince: req.user.created_at,
      role,
      roleTitle: ROLES[role].title,
      perms: ROLES[role].perms,
      isAdmin: role !== 'customer',
      coins: req.user.coins || 0,
      coinsEnabled: Settings.get().coinsEnabled,
      lang: req.user.lang ? normalizeLang(req.user.lang) : null,
      avatar: req.user.avatar || '',
      branchId: req.user.branch_id || null,
    });
  } catch (err) {
    logger.error('GET /api/me xatosi', err);
    res.status(500).json({ error: 'Profilni yuklab boʻlmadi' });
  }
}

module.exports = {
  escapeHtml,
  normalizePhone,
  handleStart,
  handleHelp,
  handlePhoneCommand,
  handleContact,
  handleOrdersCommand,
  handleAdminCommand,
  handleLangCommand,
  handleLangCallback,
  getMe,
};
