// Bot instansiyasini yaratish
const { Bot, GrammyError, HttpError } = require('grammy');
const config = require('../config/default');
const logger = require('../utils/logger');

const bot = new Bot(config.botToken);

bot.catch((err) => {
  const ctx = err.ctx;
  const e = err.error;
  const where = ctx && ctx.update ? `update ${ctx.update.update_id}` : 'nomaʼlum update';
  if (e instanceof GrammyError) {
    logger.error(`Telegram API xatosi (${where}): ${e.description}`);
  } else if (e instanceof HttpError) {
    logger.error(`Telegram bilan aloqa xatosi (${where})`, e);
  } else {
    logger.error(`Bot handler xatosi (${where})`, e);
  }
});

module.exports = bot;
