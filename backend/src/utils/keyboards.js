// Tugmalar shablonlari
const { InlineKeyboard, Keyboard } = require('grammy');
const config = require('../config/default');
const { t } = require('./i18n');

const isHttps = (url) => /^https:\/\//i.test(url || '');

function webAppAvailable() {
  return isHttps(config.webAppUrl);
}

function appUrl(params = {}) {
  const url = new URL(config.webAppUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

// /start dagi asosiy tugma — Mini App ni ochadi
function mainMenu(lang = 'uz') {
  const kb = new InlineKeyboard();
  if (webAppAvailable()) kb.webApp(t(lang, 'openMenu'), config.webAppUrl).row();
  if (config.supportUsername) kb.url(t(lang, 'support'), `https://t.me/${config.supportUsername}`);
  return kb;
}

// Stoldagi QR orqali kelgan mijoz uchun — zal rejimida ochiladi
function dineInMenu(lang, branchId, table) {
  return new InlineKeyboard().webApp(t(lang, 'dineInBtn'), appUrl({ dinein: branchId, table }));
}

// Til tanlash
function langKeyboard() {
  return new InlineKeyboard().text('🇺🇿 Oʻzbekcha', 'lang:uz').text('🇷🇺 Русский', 'lang:ru').text('🇬🇧 English', 'lang:en');
}

// Admin/xodim panelini ochuvchi tugma
function adminPanel(label = '🛠 Panelni ochish') {
  return new InlineKeyboard().webApp(label, appUrl({ admin: 1 }));
}

function panelButton() {
  return webAppAvailable() ? adminPanel('🛠 Panelda ochish') : undefined;
}

// Telefon raqamni chat orqali ulashish
function contactRequest(lang = 'uz') {
  return new Keyboard().requestContact(t(lang, 'phoneBtn')).resized().oneTime();
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

// Filial chatidagi buyurtma kartasi ostidagi status tugmalari
function adminOrderKeyboard(order) {
  const kb = new InlineKeyboard();
  const id = order.id;
  const dinein = order.order_type === 'dinein';
  if (order.status === 'new') {
    kb.text('👨‍🍳 Qabul qilish', `st:${id}:accepted`).text('❌ Bekor', `st:${id}:cancelled`);
  } else if (order.status === 'accepted') {
    kb.text('📦 Tayyor', `st:${id}:ready`).text('❌ Bekor', `st:${id}:cancelled`);
  } else if (order.status === 'ready') {
    if (dinein) kb.text('✅ Stolga berildi', `st:${id}:done`);
    else kb.text('🛵 Yoʻlga chiqdi', `st:${id}:delivering`).text('❌ Bekor', `st:${id}:cancelled`);
  } else if (order.status === 'delivering') {
    kb.text('✅ Yetkazildi', `st:${id}:done`);
  }
  return kb;
}

// Mijozga buyurtma holati haqidagi xabar ostidagi tugma
function orderStatusKeyboard(lang = 'uz') {
  const kb = new InlineKeyboard();
  if (webAppAvailable()) kb.webApp(t(lang, 'orderAgain'), config.webAppUrl);
  return kb;
}

module.exports = {
  webAppAvailable,
  mainMenu,
  dineInMenu,
  langKeyboard,
  adminPanel,
  panelButton,
  contactRequest,
  removeKeyboard,
  adminOrderKeyboard,
  orderStatusKeyboard,
};
