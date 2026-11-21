// Xatoliklarni yozib borish (konsol + logs/app.log)
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
  // papka yaratib bo'lmasa, faqat konsolga yozamiz
}

function serialize(extra) {
  if (!extra) return '';
  if (extra instanceof Error) return ` | ${extra.stack || extra.message}`;
  try {
    return ` | ${JSON.stringify(extra)}`;
  } catch {
    return ` | ${String(extra)}`;
  }
}

function write(level, message, extra) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}${serialize(extra)}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(line);
  if (level !== 'debug') {
    fs.appendFile(LOG_FILE, line + '\n', () => {});
  }
}

module.exports = {
  info: (msg, extra) => write('info', msg, extra),
  warn: (msg, extra) => write('warn', msg, extra),
  error: (msg, extra) => write('error', msg, extra),
  debug: (msg, extra) => {
    if (process.env.NODE_ENV !== 'production') write('debug', msg, extra);
  },
};
