// Hamma handlerlarni bitta joyga yig'ish: bot handlerlari + Mini App uchun HTTP API
const express = require('express');
const startController = require('../controllers/startController');
const cartController = require('../controllers/cartController');
const adminController = require('../controllers/adminController');
const profileController = require('../controllers/profileController');
const { botAuth, apiAuth, requirePerm, staffOnly } = require('../middlewares/auth.middleware');

function registerBotRoutes(bot) {
  bot.use(botAuth);

  bot.command('start', startController.handleStart);
  bot.command('help', startController.handleHelp);
  bot.command('phone', startController.handlePhoneCommand);
  bot.command('orders', startController.handleOrdersCommand);
  bot.command('admin', startController.handleAdminCommand);
  bot.command(['lang', 'til', 'language'], startController.handleLangCommand);
  bot.callbackQuery(/^lang:(uz|ru|en)$/, startController.handleLangCallback);

  bot.on('message:contact', startController.handleContact);

  // To'lovlar (Telegram Stars va Click/Payme)
  bot.on('pre_checkout_query', cartController.handlePreCheckout);
  bot.on('message:successful_payment', cartController.handleSuccessfulPayment);

  // Admin guruhidagi status tugmalari: st:<orderId>:<status>
  bot.callbackQuery(/^st:\d+:[a-z]+$/, cartController.handleAdminStatus);

  // Boshqa har qanday matnga — menyu
  bot.on('message:text', startController.handleStart);
}

function registerApiRoutes(app) {
  const api = express.Router();

  api.get('/health', (req, res) => res.json({ ok: true }));
  api.get('/catalog', cartController.getCatalog);

  api.get('/me', apiAuth, startController.getMe);
  api.get('/orders', apiAuth, cartController.getMyOrders);
  api.post('/orders', apiAuth, cartController.createOrder);

  // Profil, manzillar, coinlar
  api.patch('/me', apiAuth, profileController.updateMe);
  api.patch('/me/lang', apiAuth, profileController.setLang);
  api.put('/me/avatar', apiAuth, profileController.setAvatar);
  api.post('/branches/detect', cartController.detectBranch);
  api.get('/qr/table/:branchId/:table.png', adminController.tableQr);
  api.get('/stories/:id/image', adminController.storyImage);
  api.get('/addresses', apiAuth, profileController.listAddresses);
  api.post('/addresses', apiAuth, profileController.createAddress);
  api.patch('/addresses/:id', apiAuth, profileController.updateAddress);
  api.post('/addresses/:id/default', apiAuth, profileController.setDefaultAddress);
  api.delete('/addresses/:id', apiAuth, profileController.removeAddress);
  api.post('/geocode', apiAuth, profileController.reverseGeocode);
  api.get('/coins', apiAuth, profileController.getCoins);

  // Admin / xodimlar paneli (rolga qarab ruxsat)
  const can = (perm) => [apiAuth, requirePerm(perm)];
  api.get('/admin/stats', ...can('stats'), adminController.getStats);
  api.get('/admin/orders', apiAuth, staffOnly, adminController.listOrders);
  api.patch('/admin/orders/:id', apiAuth, staffOnly, adminController.updateOrderStatus);
  api.get('/admin/products', apiAuth, staffOnly, adminController.listProducts);
  api.get('/admin/stories', ...can('ads'), adminController.listStories);
  api.post('/admin/stories', ...can('ads'), adminController.createStory);
  api.post('/admin/stories/reorder', ...can('ads'), adminController.reorderStories);
  api.patch('/admin/stories/:id', ...can('ads'), adminController.updateStory);
  api.delete('/admin/stories/:id', ...can('ads'), adminController.deleteStory);
  api.get('/admin/categories', ...can('menu'), adminController.listCategories);
  api.post('/admin/categories', ...can('menu'), adminController.createCategory);
  api.patch('/admin/categories/:id', ...can('menu'), adminController.updateCategory);
  api.delete('/admin/categories/:id', ...can('menu'), adminController.deleteCategory);
  api.post('/admin/products', ...can('menu'), adminController.createProduct);
  api.patch('/admin/products/:id', ...can('menu'), adminController.updateProduct);
  api.get('/admin/banners', ...can('ads'), adminController.listBanners);
  api.post('/admin/banners', ...can('ads'), adminController.createBanner);
  api.patch('/admin/banners/:id', ...can('ads'), adminController.updateBanner);
  api.get('/admin/branches', apiAuth, staffOnly, adminController.listBranches);
  api.post('/admin/branches', ...can('branches'), adminController.createBranch);
  api.patch('/admin/branches/:id', ...can('branches'), adminController.updateBranch);
  api.delete('/admin/branches/:id', ...can('branches'), adminController.deleteBranch);
  api.get('/admin/staff', ...can('staff'), adminController.listStaff);
  api.post('/admin/staff/invites', ...can('staff'), adminController.createInvite);
  api.patch('/admin/staff/:telegramId', ...can('staff'), adminController.updateStaff);
  api.get('/admin/settings', ...can('settings'), adminController.getSettings);
  api.patch('/admin/settings', ...can('settings'), adminController.updateSettings);

  app.use('/api', api);
}

module.exports = { registerBotRoutes, registerApiRoutes };
