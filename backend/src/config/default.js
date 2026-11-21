// Sozlamalar va o'zgaruvchilar
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`.env faylida ${name} o'zgaruvchisi topilmadi`);
  }
  return value.trim();
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),

  botToken: required('BOT_TOKEN'),
  databaseUrl: required('DATABASE_URL'),
  adminChatId: required('ADMIN_CHAT_ID'),
  // Admin panelga kira oladigan Telegram ID'lar (vergul bilan). ADMIN_CHAT_ID shaxsiy chat bo'lsa, u ham qo'shiladi
  adminIds: (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Mini App manzili (HTTPS bo'lishi shart, aks holda Telegram web_app tugmasini qabul qilmaydi)
  webAppUrl: (process.env.WEBAPP_URL || '').trim(),
  // Frontend domeni (CORS uchun). Bir nechta bo'lsa vergul bilan ajrating. "*" — hammasiga ruxsat
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),

  // Click/Payme provayder tokeni (@BotFather -> Payments). Bo'sh bo'lsa, bu usul o'chiq turadi
  paymentProviderToken: (process.env.PAYMENT_PROVIDER_TOKEN || '').trim(),
  // Kripto to'lov uchun hamyon manzili (USDT TRC20 va h.k.)
  cryptoWallet: (process.env.CRYPTO_WALLET || '').trim(),
  supportUsername: (process.env.SUPPORT_USERNAME || '').replace('@', '').trim(),

  // Faqat lokal sinov uchun: Telegramdan tashqarida (brauzerda) API ga ruxsat beradi
  devSkipAuth: process.env.DEV_SKIP_AUTH === 'true',

  brand: {
    name: 'Ayde Pizza',
    tagline: 'Issiq pitsa — 30 daqiqada eshigingizda',
    slogan: 'Har luqmadan rohatlaning',
  },

  currency: 'UZS',
  // 1 ⭐ Telegram Stars necha so'mga teng (taxminiy kurs)
  starsRate: Number(process.env.STARS_RATE || 200),

  delivery: {
    fee: 12000,
    freeFrom: 150000,
  },

  limits: {
    maxQtyPerItem: 20,
    maxLines: 30,
  },
};

if (/^\d+$/.test(config.adminChatId) && !config.adminIds.includes(config.adminChatId)) {
  config.adminIds.push(config.adminChatId);
}

// ---------------- KATALOG ----------------
// Eslatma: mahsulotlar birinchi ishga tushishda bazadagi "products" jadvaliga ko'chiriladi,
// keyin ular admin paneldan tahrirlanadi (bu yerdagi ro'yxat faqat boshlang'ich menyu).

config.categories = [
  { id: 'all', title: 'Barchasi', emoji: '🍕' },
  { id: 'hit', title: 'Eng koʻp sotilganlar', emoji: '🔥' },
  { id: 'premium', title: 'Premium', emoji: '👑' },
  { id: 'meat', title: 'Goʻshtli', emoji: '🥩' },
  { id: 'cheese', title: 'Pishloqli', emoji: '🧀' },
  { id: 'veggie', title: 'Vegetarian', emoji: '🥦' },
];

config.products = [
  {
    id: 'pepperoni',
    rating: 4.9,
    reviews: '1.2K+',
    name: 'Pepperoni',
    description: 'Achchiqroq pepperoni kolbasasi va choʻziluvchan motsarella',
    image: '/images/pepperoni.jpg',
    categories: ['hit', 'meat'],
    oldPrice: 89000,
    price: 69000,
    size: '30 sm',
    weight: '620 g',
    badge: 'Hit',
    ingredients: [
      'Ikki baravar pepperoni kolbasasi',
      'Motsarella pishlogʻi — 150 g',
      'Firmaviy pomidor sousi',
      'Italyan oʻtlari va oregano',
    ],
  },
  {
    id: 'margarita',
    rating: 4.8,
    reviews: '980+',
    name: 'Margarita',
    description: 'Klassika: pomidor, motsarella va yangi rayhon',
    image: '/images/margarita.jpg',
    categories: ['hit', 'cheese', 'veggie'],
    oldPrice: 65000,
    price: 49000,
    size: '30 sm',
    weight: '540 g',
    badge: 'Hit',
    ingredients: [
      'Motsarella pishlogʻi — 180 g',
      'Yangi uzilgan pomidorlar',
      'Yangi rayhon barglari',
      'Zaytun moyi (Extra Virgin)',
    ],
  },
  {
    id: 'four-cheese',
    rating: 4.9,
    reviews: '640+',
    name: 'Toʻrt pishloq',
    description: 'Motsarella, parmezan, chedder va dor-blyu uygʻunligi',
    image: '/images/four-cheese.jpg',
    categories: ['premium', 'cheese', 'veggie'],
    oldPrice: 109000,
    price: 89000,
    size: '30 sm',
    weight: '600 g',
    badge: 'Premium',
    ingredients: [
      'Motsarella va chedder',
      '24 oy saqlangan parmezan',
      'Dor-blyu (koʻk pishloq)',
      'Qaymoqli sous asosida',
    ],
  },
  {
    id: 'bbq-chicken',
    rating: 4.8,
    reviews: '870+',
    name: 'BBQ tovuq',
    description: 'Dudlangan tovuq, qizil piyoz va BBQ sous',
    image: '/images/bbq-chicken.jpg',
    categories: ['hit', 'meat'],
    oldPrice: 95000,
    price: 79000,
    size: '30 sm',
    weight: '680 g',
    badge: 'Hit',
    ingredients: [
      'Dudlangan tovuq filesi',
      'Qizil piyoz va bolgar qalampiri',
      'Firmaviy BBQ sousi',
      'Motsarella pishlogʻi',
    ],
  },
  {
    id: 'meat-lovers',
    rating: 4.9,
    reviews: '720+',
    name: 'Goʻsht ziyofati',
    description: 'Mol goʻshti, pepperoni, vetchina va tovuq — 4 xil goʻsht',
    image: '/images/meat-lovers.jpg',
    categories: ['premium', 'meat'],
    oldPrice: 125000,
    price: 99000,
    size: '30 sm',
    weight: '760 g',
    badge: 'Premium',
    ingredients: [
      'Mol goʻshti qiymasi va vetchina',
      'Pepperoni va tovuq filesi',
      'Motsarella — ikki qavat',
      'Achchiq jalapeno (ixtiyoriy)',
    ],
  },
  {
    id: 'truffle',
    rating: 4.7,
    reviews: '310+',
    name: 'Trufelli qoʻziqorin',
    description: 'Shampinon, trufel moyi va qaymoqli sous',
    image: '/images/truffle.jpg',
    categories: ['premium', 'veggie'],
    oldPrice: 139000,
    price: 115000,
    size: '30 sm',
    weight: '590 g',
    badge: 'Yangi',
    ingredients: [
      'Shampinon va oyster qoʻziqorinlari',
      'Haqiqiy trufel moyi',
      'Qaymoqli sous asosida',
      'Parmezan va rukkola',
    ],
  },
  {
    id: 'hawaii',
    rating: 4.6,
    reviews: '450+',
    name: 'Gavayi',
    description: 'Tovuq, ananas va motsarella — shirin-shoʻr taʼm',
    image: '/images/hawaii.jpg',
    categories: ['cheese', 'meat'],
    oldPrice: 79000,
    price: 65000,
    size: '30 sm',
    weight: '610 g',
    ingredients: [
      'Shirali ananas boʻlaklari',
      'Tovuq filesi',
      'Motsarella pishlogʻi',
      'Qaymoqli sous',
    ],
  },
  {
    id: 'veggie',
    rating: 4.7,
    reviews: '390+',
    name: 'Sabzavotli',
    description: 'Bolgar qalampiri, zaytun, pomidor va qoʻziqorin',
    image: '/images/veggie.jpg',
    categories: ['veggie'],
    oldPrice: 72000,
    price: 59000,
    size: '30 sm',
    weight: '570 g',
    ingredients: [
      'Bolgar qalampiri va pomidor',
      'Qora zaytun',
      'Shampinon qoʻziqorinlari',
      'Motsarella va rayhon',
    ],
  },
];

// Order Bump — savatchadagi bitta "switch" orqali qo'shiladigan bonus
config.orderBump = {
  id: 'combo-bonus',
  title: 'Coca-Cola 1 L + 2 ta firmaviy sous',
  description: 'Pitsangizga eng mos juftlik. Alohida olinsa 32 000 soʻm',
  oldPrice: 32000,
  price: 15000,
};

// Story bloki — chegirmalar, keyslar va mijozlar sharhlari
config.stories = [
  {
    id: 'promo-30',
    title: '−25%',
    emoji: '🔥',
    type: 'promo',
    gradient: ['#FF5A36', '#FF9A3C'],
    heading: 'Bugun barcha pitsalarga 25% gacha chegirma',
    text: 'Chegirma avtomatik qoʻllanadi — katalogdagi qizil narxlar allaqachon yangilangan.',
    cta: { label: 'Katalogni ochish', action: 'catalog' },
  },
  {
    id: 'review-dilnoza',
    title: 'Sharhlar',
    emoji: '⭐️',
    type: 'review',
    gradient: ['#7B2FF7', '#F107A3'],
    heading: '“Pitsa qutini ochganimda hali bugʻ chiqib turardi!”',
    text: 'Dilnoza, Yunusobod — 23 marta buyurtma bergan',
    rating: 5,
  },
  {
    id: 'case-30min',
    title: '30 daqiqa',
    emoji: '⏱',
    type: 'case',
    gradient: ['#0F9D58', '#53D27A'],
    heading: 'Oʻrtacha yetkazish vaqti — 27 daqiqa',
    text: 'Oʻtgan oyda 4 812 ta buyurtmaning 96% i 30 daqiqadan tez yetib bordi.',
  },
  {
    id: 'new-truffle',
    title: 'Yangilik',
    emoji: '🍄',
    type: 'promo',
    gradient: ['#3A2618', '#A0703C'],
    heading: 'Yangi: Trufelli qoʻziqorin',
    text: 'Haqiqiy trufel moyi va qaymoqli sous. Birinchi haftada −17%.',
    cta: { label: 'Tatib koʻrish', action: 'product:truffle' },
  },
  {
    id: 'review-jasur',
    title: 'Mijozlar',
    emoji: '💬',
    type: 'review',
    gradient: ['#1565C0', '#42A5F5'],
    heading: '“Ofisga 12 ta pitsa buyurtma qildik — hammasi issiq va oʻz vaqtida”',
    text: 'Jasur, IT-kompaniya rahbari',
    rating: 5,
  },
];

config.paymentMethods = [
  { id: 'stars', title: 'Telegram Stars', subtitle: 'Bir bosishda toʻlov', emoji: '⭐️' },
  { id: 'provider', title: 'Click / Payme', subtitle: 'Telegram Pay orqali', emoji: '💳' },
  { id: 'crypto', title: 'Kripto (USDT)', subtitle: 'Operator hamyon yuboradi', emoji: '🪙' },
  { id: 'cash', title: 'Naqd yoki karta', subtitle: 'Kuryerga yetkazilganda', emoji: '💵' },
];

module.exports = config;
