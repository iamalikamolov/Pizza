// Asosiy ishga tushirish fayli
const express = require('express');
const cors = require('cors');
const config = require('./config/default');
const bot = require('./core/bot');
const db = require('./database/connection');
const User = require('./models/User');
const Order = require('./models/Order');
const Product = require('./models/Product');
const Banner = require('./models/Banner');
const Settings = require('./models/Settings');
const Address = require('./models/Address');
const Branch = require('./models/Branch');
const Category = require('./models/Category');
const Story = require('./models/Story');
const { registerBotRoutes, registerApiRoutes } = require('./routes/bot.routes');
const keyboards = require('./utils/keyboards');
const logger = require('./utils/logger');

async function setupBotProfile() {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Bosh menyu' },
    { command: 'orders', description: 'Buyurtmalarim' },
    { command: 'phone', description: 'Telefon raqamni yangilash' },
    { command: 'lang', description: 'Til / Язык / Language' },
    { command: 'help', description: 'Yordam' },
    { command: 'admin', description: 'Admin panel (faqat adminlar)' },
  ]);

  if (keyboards.webAppAvailable()) {
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: '🍕 Menyu', web_app: { url: config.webAppUrl } },
    });
  } else {
    logger.warn('WEBAPP_URL HTTPS emas yoki boʻsh — Mini App tugmalari koʻrsatilmaydi.');
  }
}

async function main() {
  // 1. Baza
  const now = await db.checkConnection();
  logger.info(`PostgreSQL ulandi (${new Date(now).toISOString()})`);
  await User.init();
  await Order.init();
  await Category.init();
  await Story.init();
  await Product.init();
  await Banner.init();
  await Settings.init();
  await Address.init();
  await Branch.init();
  logger.info(
    `Jadvallar tayyor: users, orders, products (${Product.all().length} ta), banners (${Banner.all().length} ta)`
  );
  logger.info(`Adminlar: ${config.adminIds.join(', ') || 'yoʻq'}`);

  // Bot ma'lumotlari (username) API'dan oldin kerak: QR kodlar va xodim taklif havolalari uchun
  await bot.init();

  // 2. HTTP API (Mini App uchun)
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: config.corsOrigin.includes('*') ? true : config.corsOrigin,
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '600kb' })); // profil va storis rasmlari uchun
  registerApiRoutes(app);
  app.use((req, res) => res.status(404).json({ error: 'Topilmadi' }));
  app.use((err, req, res, next) => {
    logger.error(`HTTP xatosi ${req.method} ${req.path}`, err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: 'Server xatosi' });
  });

  const server = app.listen(config.port, () => {
    logger.info(`API ishga tushdi: http://localhost:${config.port}/api`);
  });

  // 3. Bot
  registerBotRoutes(bot);
  await setupBotProfile();
  bot.start({
    allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
    onStart: (me) => logger.info(`Bot ishga tushdi: @${me.username}`),
  });

  // 4. To'g'ri yopilish
  const shutdown = async (signal) => {
    logger.info(`${signal} — toʻxtatilmoqda...`);
    await bot.stop();
    server.close();
    await db.close();
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => logger.error('unhandledRejection', err));

main().catch((err) => {
  logger.error('Ishga tushirishda xato', err);
  process.exit(1);
});
