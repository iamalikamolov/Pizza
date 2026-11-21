'use client';

// Uch tilli interfeys: o'zbekcha / ruscha / inglizcha
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Lang = 'uz' | 'ru' | 'en';
export const LANGS: Array<{ id: Lang; label: string; flag: string }> = [
  { id: 'uz', label: 'Oʻzbekcha', flag: '🇺🇿' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];

export function normalizeLang(code?: string | null): Lang {
  const c = String(code || '').toLowerCase().slice(0, 2);
  if (['ru', 'uk', 'be', 'kk'].includes(c)) return 'ru';
  if (c === 'en') return 'en';
  return 'uz';
}

// [o'zbekcha, ruscha, inglizcha]
const D = {
  // umumiy
  sum: ['soʻm', 'сум', 'UZS'],
  close: ['Yopish', 'Закрыть', 'Close'],
  save: ['Saqlash', 'Сохранить', 'Save'],
  saved: ['✓ Saqlandi', '✓ Сохранено', '✓ Saved'],
  retry: ['Qayta urinish', 'Повторить', 'Try again'],
  guest: ['Mehmon', 'Гость', 'Guest'],
  loading: ['Pechka qizimoqda…', 'Разогреваем печь…', 'Heating the oven…'],
  pcs: ['ta', 'шт', 'pcs'],
  // til tanlash, yuklanish, jonli fon
  choose_lang: ['Tilni tanlang', 'Выберите язык', 'Choose your language'],
  choose_lang_sub: ['Keyinroq Profil boʻlimida oʻzgartirishingiz mumkin', 'Изменить можно позже в профиле', 'You can change it later in Profile'],
  wp_title: ['Jonli fon', 'Живой фон', 'Live background'],
  wp_hint: ['Fon butun ilova ortida yengil harakatlanadi', 'Фон мягко двигается за всем приложением', 'The background gently moves behind the app'],
  wp_auto: ['Fasl boʻyicha', 'По сезону', 'By season'],
  wp_spring: ['Bahor', 'Весна', 'Spring'],
  wp_summer: ['Yoz', 'Лето', 'Summer'],
  wp_autumn: ['Kuz', 'Осень', 'Autumn'],
  wp_winter: ['Qish', 'Зима', 'Winter'],
  wp_pizza: ['Pitsa yomgʻiri', 'Пицца-дождь', 'Pizza rain'],
  wp_embers: ['Pech uchqunlari', 'Искры печи', 'Oven sparks'],
  wp_off: ['Oʻchiq', 'Выкл.', 'Off'],
  menu_sections: ['Menyu', 'Меню', 'Menu'],
  // navigatsiya
  nav_home: ['Bosh sahifa', 'Главная', 'Home'],
  nav_catalog: ['Katalog', 'Каталог', 'Menu'],
  nav_cart: ['Savatcha', 'Корзина', 'Cart'],
  nav_bonus: ['Bonuslar', 'Бонусы', 'Rewards'],
  nav_promos: ['Aksiyalar', 'Акции', 'Offers'],
  nav_profile: ['Profil', 'Профиль', 'Profile'],
  // header
  gr_night: ['Xayrli tun', 'Доброй ночи', 'Good night'],
  gr_morning: ['Xayrli tong', 'Доброе утро', 'Good morning'],
  gr_day: ['Xayrli kun', 'Добрый день', 'Good afternoon'],
  gr_evening: ['Xayrli kech', 'Добрый вечер', 'Good evening'],
  hdr_back: ['Yana xush kelibsiz!', 'С возвращением!', 'Welcome back!'],
  hdr_new: ['Bugun nima buyurtma qilamiz?', 'Что закажем сегодня?', 'What shall we order today?'],
  // manzil qatori
  deliver_to: ['Yetkazish manzili', 'Адрес доставки', 'Deliver to'],
  add_address: ['Manzilni qoʻshing', 'Добавьте адрес', 'Add an address'],
  where_deliver: ['Qayerga yetkazamiz?', 'Куда доставить?', 'Where should we deliver?'],
  search: ['Qidirish', 'Поиск', 'Search'],
  search_ph: ['Pitsa, pishloq, goʻsht qidiring…', 'Пицца, сыр, мясо…', 'Pizza, cheese, meat…'],
  sort: ['Saralash', 'Сортировка', 'Sort'],
  // bosh sahifa
  see_catalog: ['Katalogni koʻrish', 'Смотреть меню', 'View menu'],
  popular: ['Ommabop pitsalar', 'Популярные пиццы', 'Popular picks'],
  view_all: ['Barchasi', 'Все', 'View all'],
  trust_hot: ['Issiq yetkazish', 'Горячая доставка', 'Hot delivery'],
  trust_hot_s: ['Sovuq kelsa — pul qaytadi', 'Холодная — вернём деньги', 'Cold? Money back'],
  trust_time: ['27 daqiqa', '27 минут', '27 minutes'],
  trust_time_s: ['oʻrtacha yetkazish', 'среднее время', 'average delivery'],
  trust_rate: ['4.9 reyting', 'рейтинг 4.9', '4.9 rating'],
  trust_rate_s: ['10 000+ mijoz', '10 000+ клиентов', '10,000+ customers'],
  free_from: ['{sum} dan yuqori buyurtmalarga yetkazish bepul', 'Бесплатная доставка от {sum}', 'Free delivery on orders over {sum}'],
  // katalog
  catalog_title: ['Katalog', 'Каталог', 'Menu'],
  catalog_sub: ['Kartadagi + tugmasi bilan bir bosishda savatchaga qoʻshing', 'Добавляйте в корзину кнопкой + в одно касание', 'Tap + to add to cart in one go'],
  sort_popular: ['Eng mashhurlari', 'Самые популярные', 'Most popular'],
  sort_cheap: ['Avval arzonlari', 'Сначала дешёвые', 'Price: low to high'],
  sort_expensive: ['Avval qimmatlari', 'Сначала дорогие', 'Price: high to low'],
  sort_discount: ['Eng katta chegirma', 'Наибольшая скидка', 'Biggest discount'],
  not_found: ['“{q}” boʻyicha hech narsa topilmadi', 'По запросу «{q}» ничего не найдено', 'Nothing found for “{q}”'],
  empty_cat: ['Bu kategoriyada hozircha mahsulot yoʻq', 'В этой категории пока пусто', 'Nothing in this category yet'],
  go_cart: ['Savatchaga oʻtish', 'Перейти в корзину', 'Go to cart'],
  add_to_cart_aria: ['{name} ni savatchaga qoʻshish', 'Добавить {name} в корзину', 'Add {name} to cart'],
  added: ['{name} savatchaga qoʻshildi ✓', '{name} в корзине ✓', '{name} added to cart ✓'],
  // mahsulot oynasi
  you_save: ['Tejaysiz {sum}', 'Экономия {sum}', 'You save {sum}'],
  inside: ['Ichida nimalar bor', 'Что внутри', 'What’s inside'],
  safe_order: ['Xavfsiz buyurtma', 'Безопасный заказ', 'Safe order'],
  g_hot: ['Issiq yetkazish kafolati', 'Гарантия горячей доставки', 'Hot delivery guarantee'],
  g_hot_s: ['Sovuq kelsa — pulni qaytaramiz', 'Холодная — вернём деньги', 'Cold? We refund'],
  g_time: ['30 daqiqa yoki bepul', '30 минут или бесплатно', '30 minutes or free'],
  g_time_s: ['Kechiksak, keyingisi sovgʻa', 'Опоздаем — следующая в подарок', 'Late? Next one is on us'],
  g_help: ['24/7 yordam markazi', 'Поддержка 24/7', '24/7 support'],
  g_help_s: ['Har qanday savolga javob beramiz', 'Ответим на любой вопрос', 'We answer any question'],
  add_cart_cta: ['Savatchaga qoʻshish — {sum}', 'В корзину — {sum}', 'Add to cart — {sum}'],
  // savatcha
  cart_empty: ['Savatchangiz hozircha boʻsh', 'Ваша корзина пуста', 'Your cart is empty'],
  cart_empty_s: ['Bugungi chegirmalar bilan sevimli pitsangizni tanlang — 30 daqiqada issiq holda yetkazamiz.', 'Выберите любимую пиццу со скидкой — доставим горячей за 30 минут.', 'Pick your favourite pizza with today’s discounts — delivered hot in 30 minutes.'],
  to_catalog: ['Katalogga oʻtish', 'Перейти в каталог', 'Go to menu'],
  cart_title: ['Savatcha', 'Корзина', 'Cart'],
  cart_sub: ['Siz nimalarni olyapsiz', 'Что вы заказываете', 'What you’re getting'],
  free_left: ['Bepul yetkazishgacha yana {sum}', 'До бесплатной доставки ещё {sum}', '{sum} more for free delivery'],
  free_yes: ['🎉 Sizga yetkazib berish bepul!', '🎉 Доставка бесплатна!', '🎉 Delivery is free!'],
  rewards_in_cart: ['🎁 Coinga olinadiganlar', '🎁 За монеты', '🎁 Paid with coins'],
  remove: ['Olib tashlash', 'Удалить', 'Remove'],
  items_n: ['Mahsulotlar ({n} ta)', 'Товары ({n})', 'Items ({n})'],
  extra_offer: ['Qoʻshimcha taklif', 'Доп. предложение', 'Add-on'],
  delivery: ['Yetkazib berish', 'Доставка', 'Delivery'],
  free: ['Bepul', 'Бесплатно', 'Free'],
  with_coins: ['Coin bilan', 'Монетами', 'With coins'],
  you_saving: ['Siz tejayapsiz', 'Вы экономите', 'You save'],
  total: ['Jami', 'Итого', 'Total'],
  or_stars: ['yoki {stars}', 'или {stars}', 'or {stars}'],
  pay_method: ['Toʻlov usuli', 'Способ оплаты', 'Payment method'],
  order_cta: ['Buyurtma berish — {sum}', 'Оформить — {sum}', 'Place order — {sum}'],
  cart_trust: ['🔒 Xavfsiz toʻlov · ♨️ Issiq yetkazish kafolati', '🔒 Безопасная оплата · ♨️ Горячая доставка', '🔒 Secure payment · ♨️ Hot delivery'],
  soon: ['Tez orada', 'Скоро', 'Coming soon'],
  bump_kicker: ['Maxsus taklif', 'Спецпредложение', 'Special offer'],
  bump_text: ['Bunga qoʻshimcha ravishda {title} ni atigi {price} ga qoʻshasizmi?', 'Добавить {title} всего за {price}?', 'Add {title} for just {price}?'],
  // buyurtma turi
  type_delivery: ['🛵 Yetkazib berish', '🛵 Доставка', '🛵 Delivery'],
  type_dinein: ['🍽 Zalda', '🍽 В зале', '🍽 Dine in'],
  dine_branch: ['Filial', 'Филиал', 'Branch'],
  dine_table: ['Stol raqami', 'Номер стола', 'Table number'],
  dine_detect: ['📍 Men filialdaman — aniqlash', '📍 Я в филиале — определить', '📍 I’m at a branch — detect'],
  dine_detecting: ['Aniqlanmoqda…', 'Определяем…', 'Detecting…'],
  dine_not_inside: ['Siz hech bir filial ichida emassiz. Filial va stolni qoʻlda tanlang.', 'Вы не в филиале. Выберите филиал и стол вручную.', 'You’re not inside a branch. Pick the branch and table manually.'],
  dine_prompt: ['Siz {branch} filialidasiz. Zalda buyurtma berasizmi?', 'Вы в филиале {branch}. Заказать в зале?', 'You’re at {branch}. Order to your table?'],
  dine_yes: ['Ha, zalda', 'Да, в зале', 'Yes, dine in'],
  dine_no: ['Yoʻq, yetkazish', 'Нет, доставка', 'No, delivery'],
  dine_qr: ['🍽 {branch} · {table}-stol', '🍽 {branch} · стол {table}', '🍽 {branch} · table {table}'],
  dine_need: ['Filial va stol raqamini tanlang', 'Выберите филиал и номер стола', 'Choose a branch and table number'],
  // rasmiylashtirish
  confirm_title: ['Buyurtmani tasdiqlang', 'Подтвердите заказ', 'Confirm your order'],
  where_to: ['📍 Qayerga yetkazamiz?', '📍 Куда доставить?', '📍 Where to deliver?'],
  receiver: ['👤 Qabul qiluvchi', '👤 Получатель', '👤 Recipient'],
  full_name: ['Ism va familiya', 'Имя и фамилия', 'Full name'],
  full_name_ph: ['Aziz Karimov', 'Иван Петров', 'John Smith'],
  phone: ['Telefon raqam', 'Номер телефона', 'Phone number'],
  tg_phone: ['📱 Telegram raqamimni yuborish', '📱 Отправить номер из Telegram', '📱 Use my Telegram number'],
  order_comment: ['Buyurtmaga izoh (ixtiyoriy)', 'Комментарий к заказу (необязательно)', 'Order note (optional)'],
  order_comment_ph: ['Masalan: achchiqroq qiling', 'Например: поострее', 'E.g. make it spicier'],
  err_name: ['Ism va familiyani toʻliq kiriting', 'Введите имя и фамилию полностью', 'Enter your full name'],
  err_phone: ['Raqamni +998 XX XXX XX XX koʻrinishida kiriting', 'Введите номер в формате +998 XX XXX XX XX', 'Use the format +998 XX XXX XX XX'],
  err_address: ['Yetkazish manzilini qoʻshing', 'Добавьте адрес доставки', 'Add a delivery address'],
  pay_stars: ['Toʻlash — {stars}', 'Оплатить — {stars}', 'Pay — {stars}'],
  pay_sum: ['Toʻlash — {sum}', 'Оплатить — {sum}', 'Pay — {sum}'],
  confirm_sum: ['Buyurtmani tasdiqlash — {sum}', 'Подтвердить — {sum}', 'Confirm — {sum}'],
  pay_cancelled: ['Toʻlov bekor qilindi. Tayyor boʻlsangiz, qaytadan bosing.', 'Оплата отменена. Нажмите снова, когда будете готовы.', 'Payment cancelled. Tap again when ready.'],
  pay_failed: ['Toʻlov amalga oshmadi. Boshqa usulni tanlab koʻring.', 'Оплата не прошла. Попробуйте другой способ.', 'Payment failed. Try another method.'],
  choose_payment: ['Iltimos, mavjud toʻlov usulini tanlang', 'Выберите доступный способ оплаты', 'Please choose an available payment method'],
  coins_short: ['Coin yetarli emas: kerak {need}, sizda {have}', 'Не хватает монет: нужно {need}, у вас {have}', 'Not enough coins: need {need}, you have {have}'],
  // muvaffaqiyat
  success_title: ['Buyurtmangiz qabul qilindi!', 'Заказ принят!', 'Order confirmed!'],
  success_paid: ['Toʻlov muvaffaqiyatli oʻtdi. ', 'Оплата прошла успешно. ', 'Payment successful. '],
  success_text: ['Jami {sum}. Operatorimiz tez orada bogʻlanadi, buyurtma holatini botdagi xabarlardan kuzatib borasiz.', 'Итого {sum}. Оператор скоро свяжется с вами, статус заказа будет приходить в бот.', 'Total {sum}. We’ll contact you shortly — follow the status in the bot.'],
  success_branch: ['Filial: {branch}', 'Филиал: {branch}', 'Branch: {branch}'],
  tl_accepted: ['📝 Qabul qilindi', '📝 Принят', '📝 Confirmed'],
  tl_cooking: ['👨‍🍳 Tayyorlanmoqda', '👨‍🍳 Готовится', '👨‍🍳 Cooking'],
  tl_way: ['🛵 Yoʻlda', '🛵 В пути', '🛵 On the way'],
  tl_table: ['🍽 Stolga', '🍽 К столу', '🍽 To your table'],
  back_home: ['Bosh sahifaga qaytish', 'На главную', 'Back to home'],
  // manzillar
  lbl_home: ['Uy', 'Дом', 'Home'],
  lbl_work: ['Ish', 'Работа', 'Work'],
  lbl_other: ['Boshqa', 'Другое', 'Other'],
  addr_new: ['Yangi manzil', 'Новый адрес', 'New address'],
  addr_edit: ['Manzilni tahrirlash', 'Изменить адрес', 'Edit address'],
  addr_save: ['Manzilni saqlash', 'Сохранить адрес', 'Save address'],
  addr_short_err: ['Manzilni toʻliq kiriting (koʻcha, uy)', 'Введите адрес полностью (улица, дом)', 'Enter the full address (street, house)'],
  geo_detect: ['Joylashuvimni aniqlash', 'Определить местоположение', 'Detect my location'],
  geo_locating: ['Aniqlanmoqda…', 'Определяем…', 'Detecting…'],
  geo_done: ['Joylashuv aniqlandi', 'Местоположение определено', 'Location detected'],
  geo_hint: ['Manzil avtomatik toʻldiriladi, keyin aniqlashtirasiz', 'Адрес заполнится автоматически, затем уточните', 'We’ll fill the address, then you add details'],
  geo_progress: ['Joylashuvingiz aniqlanmoqda…', 'Определяем ваше местоположение…', 'Finding your location…'],
  geo_ok: ['Manzil aniqlandi. Endi xonadon, podyezd va moʻljalni toʻldiring 👇', 'Адрес найден. Укажите квартиру, подъезд и ориентир 👇', 'Address found. Now add apartment, entrance and landmark 👇'],
  geo_partial: ['Joylashuv saqlandi, lekin koʻcha nomini aniqlab boʻlmadi — qoʻlda yozing.', 'Координаты сохранены, но улицу определить не удалось — введите вручную.', 'Location saved, but the street wasn’t found — type it in.'],
  geo_fail: ['Joylashuvga ruxsat berilmadi yoki aniqlab boʻlmadi. Manzilni qoʻlda kiriting.', 'Нет доступа к местоположению. Введите адрес вручную.', 'Location unavailable. Please enter the address manually.'],
  map_check: ['🗺 Xaritada tekshirish', '🗺 Проверить на карте', '🗺 Check on map'],
  addr_name: ['Manzil nomi', 'Название адреса', 'Address label'],
  addr_field: ['Manzil (shahar, tuman, koʻcha, uy)', 'Адрес (город, район, улица, дом)', 'Address (city, district, street, house)'],
  addr_field_ph: ['Toshkent, Chilonzor tumani, Bunyodkor 12', 'Ташкент, Чиланзар, Бунёдкор 12', 'Tashkent, Chilanzar, Bunyodkor 12'],
  apartment: ['Xonadon / ofis', 'Кв. / офис', 'Apt / office'],
  entrance: ['Podyezd', 'Подъезд', 'Entrance'],
  floor: ['Qavat', 'Этаж', 'Floor'],
  landmark: ['Moʻljal / kuryer uchun izoh', 'Ориентир / комментарий курьеру', 'Landmark / note for courier'],
  landmark_ph: ['Masalan: Makro yonida, domofon 45', 'Например: возле Макро, домофон 45', 'E.g. next to Makro, intercom 45'],
  make_default: ['Asosiy manzil qilish', 'Сделать основным', 'Set as default'],
  default_tag: ['asosiy', 'основной', 'default'],
  add_new_address: ['Yangi manzil qoʻshish', 'Добавить адрес', 'Add new address'],
  apt_short: ['{n}-xonadon', 'кв. {n}', 'apt {n}'],
  ent_short: ['{n}-podyezd', 'подъезд {n}', 'entrance {n}'],
  edit: ['Tahrirlash', 'Изменить', 'Edit'],
  delete: ['Oʻchirish', 'Удалить', 'Delete'],
  delete_addr_q: ['“{label}” manzilini oʻchirasizmi?', 'Удалить адрес «{label}»?', 'Delete “{label}” address?'],
  // profil
  phone_missing: ['Telefon kiritilmagan', 'Телефон не указан', 'No phone yet'],
  admin_panel: ['Admin panel', 'Админ-панель', 'Admin panel'],
  staff_panel: ['Xodim paneli', 'Панель сотрудника', 'Staff panel'],
  panel_courier: ['Yetkazish uchun buyurtmalar', 'Заказы на доставку', 'Orders to deliver'],
  panel_cook: ['Oshxona buyurtmalari', 'Заказы кухни', 'Kitchen orders'],
  panel_manage: ['Buyurtmalar, menyu va boshqaruv', 'Заказы, меню и управление', 'Orders, menu and settings'],
  orders_n: ['buyurtma', 'заказов', 'orders'],
  coins_link: ['coin · bonuslar →', 'монет · бонусы →', 'coins · rewards →'],
  addresses_n: ['manzil', 'адресов', 'addresses'],
  personal: ['Shaxsiy maʼlumotlar', 'Личные данные', 'Personal details'],
  tg_phone_get: ['📱 Telegram raqamimni olish', '📱 Взять номер из Telegram', '📱 Use Telegram number'],
  my_addresses: ['Mening manzillarim', 'Мои адреса', 'My addresses'],
  history: ['Buyurtmalar tarixi', 'История заказов', 'Order history'],
  no_orders: ['Hali buyurtmalar yoʻq — birinchisini bugun bering 🍕', 'Заказов пока нет — сделайте первый сегодня 🍕', 'No orders yet — place your first today 🍕'],
  repeat: ['🔁 Takrorlash', '🔁 Повторить', '🔁 Reorder'],
  help: ['Yordam', 'Помощь', 'Help'],
  help_center: ['24/7 yordam markazi', 'Поддержка 24/7', '24/7 support'],
  help_text: ['Savol yoki taklif boʻlsa, yozing — tez javob beramiz.', 'Есть вопрос или идея? Напишите — ответим быстро.', 'Questions or ideas? Write to us — we reply fast.'],
  write_operator: ['Operatorga yozish', 'Написать оператору', 'Message support'],
  language: ['Til', 'Язык', 'Language'],
  photo_change: ['Rasmni almashtirish', 'Сменить фото', 'Change photo'],
  photo_reset: ['Telegram rasmiga qaytish', 'Вернуть фото из Telegram', 'Use Telegram photo'],
  photo_saving: ['Rasm yuklanmoqda…', 'Загружаем фото…', 'Uploading photo…'],
  photo_saved: ['Profil rasmi yangilandi ✓', 'Фото профиля обновлено ✓', 'Profile photo updated ✓'],
  photo_err: ['Rasmni yuklab boʻlmadi', 'Не удалось загрузить фото', 'Couldn’t upload the photo'],
  // bonuslar
  rewards_title: ['Bonuslar', 'Бонусы', 'Rewards'],
  rewards_sub: ['Har buyurtmadan coin yigʻing va pitsaga almashtiring', 'Копите монеты с каждого заказа и меняйте на пиццу', 'Earn coins on every order and swap them for pizza'],
  balance: ['Sizning balansingiz', 'Ваш баланс', 'Your balance'],
  coin: ['coin', 'монет', 'coins'],
  in_cart_coins: ['Savatchada {n} coin band · qoladi {left} →', 'В корзине {n} монет · останется {left} →', '{n} coins in cart · {left} left →'],
  coin_rule: ['Har 1 000 soʻm uchun {n} coin — buyurtma yetkazilgach yoziladi', '{n} монет за каждые 1 000 сум — начисляются после доставки', '{n} coins per 1,000 UZS — added after delivery'],
  swap_title: ['Coinga oling', 'Обменять монеты', 'Redeem coins'],
  no_rewards: ['Hozircha coinga olinadigan mahsulotlar yoʻq', 'Пока нет товаров за монеты', 'No rewards available yet'],
  get: ['Olish', 'Взять', 'Get'],
  need_more: ['{n} kerak', 'ещё {n}', '{n} more'],
  coin_history: ['Tarix', 'История', 'History'],
  coin_history_empty: ['Hali coin harakati yoʻq. Birinchi buyurtmangizdan boshlang 🍕', 'Пока нет движений. Начните с первого заказа 🍕', 'No activity yet. Start with your first order 🍕'],
  tx_earn: ['Buyurtma uchun', 'За заказ', 'Order reward'],
  tx_spend: ['Sarflandi', 'Списано', 'Spent'],
  tx_refund: ['Qaytarildi', 'Возвращено', 'Refunded'],
  tx_manual: ['Admin', 'Админ', 'Admin'],
  reward_added: ['🎁 {name} coinga savatchaga qoʻshildi', '🎁 {name} за монеты в корзине', '🎁 {name} added for coins'],
  promos_title: ['Aksiyalar', 'Акции', 'Offers'],
  promos_sub: ['Bugungi takliflar va yangiliklar', 'Предложения и новинки', 'Today’s deals and news'],
  no_promos: ['Hozircha aksiyalar yoʻq', 'Пока акций нет', 'No offers right now'],
  promo_default: ['Aksiya', 'Акция', 'Offer'],
  promo_more_soon: ['Batafsil maʼlumot tez orada qoʻshiladi.', 'Подробности скоро появятся.', 'More details coming soon.'],
  order_now: ['Buyurtma berish', 'Заказать', 'Order now'],
  // xatolar
  menu_error: ['Menyuni yuklab boʻlmadi', 'Не удалось загрузить меню', 'Couldn’t load the menu'],
  // onboarding
  ob_skip: ['Oʻtkazib yuborish', 'Пропустить', 'Skip'],
  ob_next: ['Davom etish', 'Далее', 'Continue'],
  ob_start: ['Boshla 🚀', 'Начать 🚀', 'Start 🚀'],
  ob_chip1: ['❄️ Sovuq pitsa', '❄️ Холодная пицца', '❄️ Cold pizza'],
  ob_chip2: ['⌛ 1.5 soat kutish', '⌛ Ждать 1,5 часа', '⌛ 1.5-hour wait'],
  ob_chip3: ['♨️ Issiq · 30 daqiqa', '♨️ Горячая · 30 мин', '♨️ Hot · 30 min'],
  ob1_title: ['Sovuq pitsa va <a>soatlab kutish</a> jonga tegdimi?', 'Надоела холодная пицца и <a>долгое ожидание</a>?', 'Tired of cold pizza and <a>endless waiting</a>?'],
  ob1_text: ['Biz pitsani pechdan chiqqan zahoti 30 daqiqada issiq holda eshigingizgacha yetkazamiz. Kechiksak — keyingisi bepul.', 'Доставим пиццу прямо из печи горячей за 30 минут. Опоздаем — следующая бесплатно.', 'We bring pizza straight from the oven, hot, in 30 minutes. Late? The next one is free.'],
  ob_s1: ['Tanlang', 'Выберите', 'Pick'],
  ob_s1t: ['Sevimli pitsangizni bir bosishda savatga qoʻshing', 'Добавьте любимую пиццу в корзину в одно касание', 'Add your favourite pizza in one tap'],
  ob_s2: ['Toʻlang', 'Оплатите', 'Pay'],
  ob_s2t: ['Stars, Click/Payme yoki naqd — oʻzingizga qulay', 'Stars, Click/Payme или наличные — как удобно', 'Stars, Click/Payme or cash — your choice'],
  ob_s3: ['Qabul qiling', 'Получите', 'Enjoy'],
  ob_s3t: ['Kuryer issiq pitsani 30 daqiqada olib keladi', 'Курьер привезёт горячую пиццу за 30 минут', 'The courier brings it hot in 30 minutes'],
  ob2_title: ['Bu qanday ishlaydi? <a>1-2-3</a> qadamda tayyor', 'Как это работает? <a>1-2-3</a> — и готово', 'How it works: <a>1-2-3</a> and done'],
  ob2_text: ['Qoʻngʻiroq qilish, navbat kutish yoki operator bilan tortishish shart emas.', 'Не нужно звонить, ждать в очереди или спорить с оператором.', 'No calls, no queues, no arguing with operators.'],
  ob_customers: ['mamnun mijozlar', 'довольных клиентов', 'happy customers'],
  ob_reviews: ['2 300+ sharh', '2 300+ отзывов', '2,300+ reviews'],
  ob_quote: ['“Endi faqat shu yerdan buyurtma qilamiz — tez va har doim issiq!”', '«Теперь заказываем только здесь — быстро и всегда горячо!»', '“We only order here now — fast and always hot!”'],
  ob3_title: ['<a>10 000+</a> odam allaqachon biz bilan', '<a>10 000+</a> человек уже с нами', '<a>10,000+</a> people already with us'],
  ob3_text: ['Siz ham bizga qoʻshilasizmi? Birinchi buyurtmangiz uchun chegirmalar sizni kutmoqda.', 'Присоединяйтесь! Скидки на первый заказ уже ждут вас.', 'Join us! Discounts on your first order are waiting.'],
} as const;

export type TKey = keyof typeof D;
const IDX: Record<Lang, number> = { uz: 0, ru: 1, en: 2 };

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  const s: string = D[key]?.[IDX[lang]] ?? D[key]?.[0] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : '')) : s;
}

type LangState = { lang: Lang; chosen: boolean; setLang: (l: Lang, chosen?: boolean) => void };

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'uz',
      chosen: false,
      setLang: (lang, chosen = true) => set({ lang, chosen }),
    }),
    { name: 'pizza-lang', storage: createJSONStorage(() => localStorage) }
  )
);

/** Komponentlar uchun: const { t, lang } = useT(); */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return { lang, t: (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars) };
}

export function currentLang(): Lang {
  return useLangStore.getState().lang;
}
