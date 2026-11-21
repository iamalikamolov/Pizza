// Tarjimalar: bot xabarlari (uz / ru / en) va katalog matnlari
const LANGS = ['uz', 'ru', 'en'];

function normalizeLang(code) {
  const c = String(code || '').toLowerCase().slice(0, 2);
  if (c === 'ru' || c === 'uk' || c === 'be' || c === 'kk') return 'ru';
  if (c === 'en') return 'en';
  return 'uz';
}

// ---------------- Bot xabarlari ----------------
const MESSAGES = {
  uz: {
    hello: 'Assalomu alaykum, <b>{name}</b>! 👋',
    promo1: '🔥 Bugun barcha pitsalarga <b>25% gacha chegirma</b>',
    promo2: '⏱ 30 daqiqada yetkazamiz — kechiksak, keyingisi bepul',
    promo3: '♨️ Issiq yetkazish kafolati',
    openHint: '👇 Menyuni ochish uchun quyidagi tugmani bosing',
    noWebApp: '⚠️ Mini App manzili (WEBAPP_URL) hali sozlanmagan yoki HTTPS emas.',
    openMenu: '🍕 Menyuni ochish',
    support: '💬 Yordam',
    orderAgain: '🍕 Yana buyurtma berish',
    helpTitle: '<b>Qanday buyurtma beriladi?</b>',
    help1: '1️⃣ «🍕 Menyuni ochish» tugmasini bosing',
    help2: '2️⃣ Pitsalarni savatchaga qoʻshing',
    help3: '3️⃣ Toʻlov usulini tanlab, buyurtmani tasdiqlang',
    helpCmds: '/start — bosh menyu\n/orders — buyurtmalarim\n/lang — tilni oʻzgartirish\n/phone — telefon raqam',
    phonePrompt: 'Telefon raqamingizni pastdagi tugma orqali yuboring 👇',
    phoneBtn: '📱 Raqamni yuborish',
    phoneOwn: 'Iltimos, aynan oʻz raqamingizni yuboring.',
    phoneSaved: '✅ Raqamingiz saqlandi: {phone}',
    noOrders: 'Sizda hali buyurtmalar yoʻq. Birinchi pitsangizni tanlang 🍕',
    lastOrders: '<b>Soʻnggi buyurtmalaringiz:</b>',
    langPrompt: '🌐 Tilni tanlang:',
    langSet: '✅ Til oʻzgartirildi: Oʻzbekcha',
    dineIn: '🍽 <b>{branch}</b>, {table}-stol.\n\nMenyudan tanlang — buyurtma toʻgʻridan-toʻgʻri oshxonaga boradi.',
    dineInBtn: '🍽 Menyuni ochish',
    orderAccepted: '✅ <b>Buyurtmangiz #{id} qabul qilindi!</b>',
    total: 'Jami',
    payment: 'Toʻlov',
    withCoins: '🪙 Coin bilan: {coins} coin',
    operatorSoon: 'Operatorimiz 5 daqiqa ichida siz bilan bogʻlanadi. ⏱',
    dineInSoon: '🍽 {table}-stolga olib kelamiz. Yoqimli ishtaha!',
    cryptoWallet: '🪙 USDT hamyon: <code>{wallet}</code>\nToʻlovdan soʻng chekni shu chatga yuboring.',
    paid: '🎉 <b>Toʻlov qabul qilindi! Buyurtma #{id}</b>\n\nOshpazlarimiz tayyorlashni boshladi.',
    st_accepted: '👨‍🍳 Buyurtmangiz #{id} qabul qilindi va tayyorlanmoqda!',
    st_ready: '📦 Buyurtmangiz #{id} tayyor! Kuryer tez orada olib chiqadi.',
    st_ready_dinein: '🍕 Buyurtmangiz #{id} tayyor! Hozir stolingizga olib boramiz.',
    st_delivering: '🛵 Buyurtmangiz #{id} yoʻlga chiqdi! Kuryer tez orada yetib boradi.',
    st_done: '✅ Buyurtma #{id} yetkazildi. Yoqimli ishtaha! 🍕',
    st_done_dinein: '✅ Buyurtma #{id} stolingizga berildi. Yoqimli ishtaha! 🍕',
    st_cancelled: '❌ Buyurtma #{id} bekor qilindi. Savollar boʻlsa, bizga yozing.',
    coinsRefund: '🪙 {coins} coin hisobingizga qaytarildi.',
    coinsEarned: '🪙 Hisobingizga <b>+{coins} coin</b> yozildi! Balans: {balance} coin.',
  },
  ru: {
    hello: 'Здравствуйте, <b>{name}</b>! 👋',
    promo1: '🔥 Сегодня скидки <b>до 25%</b> на все пиццы',
    promo2: '⏱ Доставим за 30 минут — опоздаем, следующая бесплатно',
    promo3: '♨️ Гарантия горячей доставки',
    openHint: '👇 Нажмите кнопку ниже, чтобы открыть меню',
    noWebApp: '⚠️ Адрес Mini App (WEBAPP_URL) не настроен или не HTTPS.',
    openMenu: '🍕 Открыть меню',
    support: '💬 Поддержка',
    orderAgain: '🍕 Заказать ещё',
    helpTitle: '<b>Как сделать заказ?</b>',
    help1: '1️⃣ Нажмите «🍕 Открыть меню»',
    help2: '2️⃣ Добавьте пиццы в корзину',
    help3: '3️⃣ Выберите способ оплаты и подтвердите заказ',
    helpCmds: '/start — главное меню\n/orders — мои заказы\n/lang — сменить язык\n/phone — номер телефона',
    phonePrompt: 'Отправьте номер телефона кнопкой ниже 👇',
    phoneBtn: '📱 Отправить номер',
    phoneOwn: 'Пожалуйста, отправьте именно свой номер.',
    phoneSaved: '✅ Номер сохранён: {phone}',
    noOrders: 'У вас пока нет заказов. Выберите свою первую пиццу 🍕',
    lastOrders: '<b>Ваши последние заказы:</b>',
    langPrompt: '🌐 Выберите язык:',
    langSet: '✅ Язык изменён: Русский',
    dineIn: '🍽 <b>{branch}</b>, стол {table}.\n\nВыберите в меню — заказ сразу уйдёт на кухню.',
    dineInBtn: '🍽 Открыть меню',
    orderAccepted: '✅ <b>Ваш заказ #{id} принят!</b>',
    total: 'Итого',
    payment: 'Оплата',
    withCoins: '🪙 Монетами: {coins}',
    operatorSoon: 'Оператор свяжется с вами в течение 5 минут. ⏱',
    dineInSoon: '🍽 Принесём к столу {table}. Приятного аппетита!',
    cryptoWallet: '🪙 USDT-кошелёк: <code>{wallet}</code>\nПосле оплаты отправьте чек в этот чат.',
    paid: '🎉 <b>Оплата получена! Заказ #{id}</b>\n\nПовара уже начали готовить.',
    st_accepted: '👨‍🍳 Ваш заказ #{id} принят и готовится!',
    st_ready: '📦 Ваш заказ #{id} готов! Курьер скоро выедет.',
    st_ready_dinein: '🍕 Ваш заказ #{id} готов! Сейчас принесём к столу.',
    st_delivering: '🛵 Ваш заказ #{id} в пути! Курьер скоро будет.',
    st_done: '✅ Заказ #{id} доставлен. Приятного аппетита! 🍕',
    st_done_dinein: '✅ Заказ #{id} подан к столу. Приятного аппетита! 🍕',
    st_cancelled: '❌ Заказ #{id} отменён. Если есть вопросы — напишите нам.',
    coinsRefund: '🪙 {coins} монет возвращено на ваш счёт.',
    coinsEarned: '🪙 Начислено <b>+{coins} монет</b>! Баланс: {balance}.',
  },
  en: {
    hello: 'Hello, <b>{name}</b>! 👋',
    promo1: '🔥 Up to <b>25% off</b> all pizzas today',
    promo2: '⏱ Delivered in 30 minutes — if we are late, the next one is free',
    promo3: '♨️ Hot delivery guarantee',
    openHint: '👇 Tap the button below to open the menu',
    noWebApp: '⚠️ The Mini App URL (WEBAPP_URL) is not set or not HTTPS.',
    openMenu: '🍕 Open menu',
    support: '💬 Support',
    orderAgain: '🍕 Order again',
    helpTitle: '<b>How to order?</b>',
    help1: '1️⃣ Tap «🍕 Open menu»',
    help2: '2️⃣ Add pizzas to the cart',
    help3: '3️⃣ Choose a payment method and confirm',
    helpCmds: '/start — main menu\n/orders — my orders\n/lang — change language\n/phone — phone number',
    phonePrompt: 'Send your phone number with the button below 👇',
    phoneBtn: '📱 Send number',
    phoneOwn: 'Please send your own number.',
    phoneSaved: '✅ Number saved: {phone}',
    noOrders: 'You have no orders yet. Pick your first pizza 🍕',
    lastOrders: '<b>Your recent orders:</b>',
    langPrompt: '🌐 Choose a language:',
    langSet: '✅ Language changed: English',
    dineIn: '🍽 <b>{branch}</b>, table {table}.\n\nPick from the menu — your order goes straight to the kitchen.',
    dineInBtn: '🍽 Open menu',
    orderAccepted: '✅ <b>Your order #{id} is confirmed!</b>',
    total: 'Total',
    payment: 'Payment',
    withCoins: '🪙 With coins: {coins}',
    operatorSoon: 'Our operator will contact you within 5 minutes. ⏱',
    dineInSoon: '🍽 We will bring it to table {table}. Enjoy your meal!',
    cryptoWallet: '🪙 USDT wallet: <code>{wallet}</code>\nSend the receipt to this chat after paying.',
    paid: '🎉 <b>Payment received! Order #{id}</b>\n\nOur chefs have started cooking.',
    st_accepted: '👨‍🍳 Your order #{id} is confirmed and being prepared!',
    st_ready: '📦 Your order #{id} is ready! The courier will leave shortly.',
    st_ready_dinein: '🍕 Your order #{id} is ready! Bringing it to your table now.',
    st_delivering: '🛵 Your order #{id} is on the way!',
    st_done: '✅ Order #{id} delivered. Enjoy your meal! 🍕',
    st_done_dinein: '✅ Order #{id} served. Enjoy your meal! 🍕',
    st_cancelled: '❌ Order #{id} was cancelled. Write to us if you have questions.',
    coinsRefund: '🪙 {coins} coins returned to your balance.',
    coinsEarned: '🪙 <b>+{coins} coins</b> added! Balance: {balance}.',
  },
};

function t(lang, key, vars = {}) {
  const l = LANGS.includes(lang) ? lang : 'uz';
  const template = MESSAGES[l][key] ?? MESSAGES.uz[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

function fmtMoney(n, lang) {
  const num = Math.round(n || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${num} ${lang === 'ru' ? 'сум' : lang === 'en' ? 'UZS' : 'soʻm'}`;
}

// ---------------- Katalog matnlari ----------------
const CONTENT = {
  brand: {
    ru: { tagline: 'Горячая пицца — у вашей двери за 30 минут', slogan: 'Наслаждайтесь каждым кусочком' },
    en: { tagline: 'Hot pizza at your door in 30 minutes', slogan: 'Enjoy every bite' },
  },
  categories: {
    all: { ru: 'Все', en: 'All' },
    hit: { ru: 'Хиты продаж', en: 'Best sellers' },
    premium: { ru: 'Премиум', en: 'Premium' },
    meat: { ru: 'Мясные', en: 'Meat' },
    cheese: { ru: 'Сырные', en: 'Cheese' },
    veggie: { ru: 'Вегетарианские', en: 'Veggie' },
  },
  paymentMethods: {
    stars: { ru: { title: 'Telegram Stars', subtitle: 'Оплата в одно касание' }, en: { title: 'Telegram Stars', subtitle: 'One-tap payment' } },
    provider: { ru: { title: 'Click / Payme', subtitle: 'Через Telegram Pay' }, en: { title: 'Click / Payme', subtitle: 'Via Telegram Pay' } },
    crypto: { ru: { title: 'Крипто (USDT)', subtitle: 'Оператор пришлёт кошелёк' }, en: { title: 'Crypto (USDT)', subtitle: 'Operator sends a wallet' } },
    cash: { ru: { title: 'Наличные или карта', subtitle: 'Курьеру при получении' }, en: { title: 'Cash or card', subtitle: 'Pay on delivery' } },
  },
  orderBump: {
    ru: { title: 'Coca-Cola 1 л + 2 фирменных соуса', description: 'Идеальная пара к пицце. По отдельности 32 000 сум' },
    en: { title: 'Coca-Cola 1 L + 2 signature sauces', description: 'The perfect match for pizza. 32,000 UZS separately' },
  },
  stories: {
    'promo-30': {
      ru: { title: '−25%', heading: 'Сегодня скидки до 25% на все пиццы', text: 'Скидка применяется автоматически — красные цены в каталоге уже обновлены.', cta: 'Открыть каталог' },
      en: { title: '−25%', heading: 'Up to 25% off all pizzas today', text: 'The discount is applied automatically — red prices in the catalog are already updated.', cta: 'Open catalog' },
    },
    'review-dilnoza': {
      ru: { title: 'Отзывы', heading: '«Когда я открыла коробку, от пиццы ещё шёл пар!»', text: 'Дильноза, Юнусабад — 23 заказа' },
      en: { title: 'Reviews', heading: '“The pizza was still steaming when I opened the box!”', text: 'Dilnoza, Yunusabad — 23 orders' },
    },
    'case-30min': {
      ru: { title: '30 минут', heading: 'Среднее время доставки — 27 минут', text: '96% из 4 812 заказов за прошлый месяц доставлены быстрее 30 минут.' },
      en: { title: '30 min', heading: 'Average delivery time — 27 minutes', text: '96% of 4,812 orders last month arrived in under 30 minutes.' },
    },
    'new-truffle': {
      ru: { title: 'Новинка', heading: 'Новинка: трюфельная с грибами', text: 'Настоящее трюфельное масло и сливочный соус. −17% в первую неделю.', cta: 'Попробовать' },
      en: { title: 'New', heading: 'New: Truffle mushroom', text: 'Real truffle oil and creamy sauce. −17% in the first week.', cta: 'Try it' },
    },
    'review-jasur': {
      ru: { title: 'Клиенты', heading: '«Заказали в офис 12 пицц — все горячие и вовремя»', text: 'Жасур, руководитель IT-компании' },
      en: { title: 'Customers', heading: '“We ordered 12 pizzas to the office — all hot and on time”', text: 'Jasur, IT company CEO' },
    },
  },
  // Boshlang'ich menyu tarjimalari (bazaga birinchi marta yoziladi)
  products: {
    pepperoni: {
      ru: { name: 'Пепперони', description: 'Острая колбаса пепперони и тянущаяся моцарелла', ingredients: ['Двойная порция пепперони', 'Моцарелла — 150 г', 'Фирменный томатный соус', 'Итальянские травы и орегано'] },
      en: { name: 'Pepperoni', description: 'Spicy pepperoni and stretchy mozzarella', ingredients: ['Double pepperoni', 'Mozzarella — 150 g', 'Signature tomato sauce', 'Italian herbs and oregano'] },
    },
    margarita: {
      ru: { name: 'Маргарита', description: 'Классика: томаты, моцарелла и свежий базилик', ingredients: ['Моцарелла — 180 г', 'Свежие томаты', 'Листья свежего базилика', 'Оливковое масло Extra Virgin'] },
      en: { name: 'Margherita', description: 'Classic: tomatoes, mozzarella and fresh basil', ingredients: ['Mozzarella — 180 g', 'Fresh tomatoes', 'Fresh basil leaves', 'Extra virgin olive oil'] },
    },
    'four-cheese': {
      ru: { name: 'Четыре сыра', description: 'Моцарелла, пармезан, чеддер и дор-блю', ingredients: ['Моцарелла и чеддер', 'Пармезан 24 месяца выдержки', 'Дор-блю', 'На сливочном соусе'] },
      en: { name: 'Four cheese', description: 'Mozzarella, parmesan, cheddar and blue cheese', ingredients: ['Mozzarella and cheddar', '24-month aged parmesan', 'Blue cheese', 'Creamy sauce base'] },
    },
    'bbq-chicken': {
      ru: { name: 'BBQ курица', description: 'Копчёная курица, красный лук и соус BBQ', ingredients: ['Копчёное куриное филе', 'Красный лук и болгарский перец', 'Фирменный соус BBQ', 'Моцарелла'] },
      en: { name: 'BBQ chicken', description: 'Smoked chicken, red onion and BBQ sauce', ingredients: ['Smoked chicken fillet', 'Red onion and bell pepper', 'Signature BBQ sauce', 'Mozzarella'] },
    },
    'meat-lovers': {
      ru: { name: 'Мясной пир', description: 'Говядина, пепперони, ветчина и курица — 4 вида мяса', ingredients: ['Говяжий фарш и ветчина', 'Пепперони и куриное филе', 'Двойная моцарелла', 'Острый халапеньо (по желанию)'] },
      en: { name: 'Meat feast', description: 'Beef, pepperoni, ham and chicken — 4 kinds of meat', ingredients: ['Ground beef and ham', 'Pepperoni and chicken fillet', 'Double mozzarella', 'Spicy jalapeño (optional)'] },
    },
    truffle: {
      ru: { name: 'Трюфельная с грибами', description: 'Шампиньоны, трюфельное масло и сливочный соус', ingredients: ['Шампиньоны и вешенки', 'Настоящее трюфельное масло', 'На сливочном соусе', 'Пармезан и руккола'] },
      en: { name: 'Truffle mushroom', description: 'Mushrooms, truffle oil and creamy sauce', ingredients: ['Champignon and oyster mushrooms', 'Real truffle oil', 'Creamy sauce base', 'Parmesan and arugula'] },
    },
    hawaii: {
      ru: { name: 'Гавайская', description: 'Курица, ананас и моцарелла — сладко-солёный вкус', ingredients: ['Сочные кусочки ананаса', 'Куриное филе', 'Моцарелла', 'Сливочный соус'] },
      en: { name: 'Hawaiian', description: 'Chicken, pineapple and mozzarella — sweet and salty', ingredients: ['Juicy pineapple chunks', 'Chicken fillet', 'Mozzarella', 'Creamy sauce'] },
    },
    veggie: {
      ru: { name: 'Овощная', description: 'Болгарский перец, оливки, томаты и грибы', ingredients: ['Болгарский перец и томаты', 'Чёрные оливки', 'Шампиньоны', 'Моцарелла и базилик'] },
      en: { name: 'Veggie', description: 'Bell pepper, olives, tomatoes and mushrooms', ingredients: ['Bell pepper and tomatoes', 'Black olives', 'Champignons', 'Mozzarella and basil'] },
    },
  },
  // Boshlang'ich reklamalar (sarlavha bo'yicha moslanadi)
  banners: {
    'Afsonaviy pitsalar': {
      ru: { kicker: 'Предложение дня', title: 'Легендарные пиццы', subtitle: 'Горячо. Быстро. За 30 минут у вашей двери.', ctaLabel: 'Новый заказ' },
      en: { kicker: 'Today’s offer', title: 'Legendary pizzas', subtitle: 'Hot. Fast. At your door in 30 minutes.', ctaLabel: 'New order' },
    },
    'Trufelli qoʻziqorin': {
      ru: { kicker: 'Новинка', title: 'Трюфельная с грибами', subtitle: 'Настоящее трюфельное масло и сливочный соус.', ctaLabel: 'Попробовать' },
      en: { kicker: 'New', title: 'Truffle mushroom', subtitle: 'Real truffle oil and creamy sauce.', ctaLabel: 'Try it' },
    },
    '150 000 soʻmdan': {
      ru: { kicker: 'Бесплатная доставка', title: 'От 150 000 сум', subtitle: 'на любой заказ — по всему городу.', ctaLabel: 'Открыть меню' },
      en: { kicker: 'Free delivery', title: 'From 150,000 UZS', subtitle: 'on any order — across the city.', ctaLabel: 'Open menu' },
    },
    'Barcha pitsalarga 25% gacha chegirma': {
      ru: { kicker: 'Только в выходные', title: 'Скидки до 25% на все пиццы', subtitle: 'Промокод не нужен — цены уже обновлены.', ctaLabel: 'Заказать' },
      en: { kicker: 'Weekend special', title: 'Up to 25% off all pizzas', subtitle: 'No promo code needed — prices are already updated.', ctaLabel: 'Order' },
    },
  },
};

/** Obyektdagi maydonlarni i18n[lang] bilan almashtiradi (bo'sh bo'lsa — o'zbekcha qoladi) */
function localize(obj, lang, fields) {
  if (!obj || lang === 'uz') return obj;
  const tr = obj.i18n?.[lang] || {};
  const out = { ...obj };
  for (const f of fields) {
    const v = tr[f];
    if (Array.isArray(v) ? v.length : typeof v === 'string' && v.trim()) out[f] = v;
  }
  return out;
}

module.exports = { LANGS, normalizeLang, t, fmtMoney, CONTENT, localize };
