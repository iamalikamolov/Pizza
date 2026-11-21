// Mijoz profili: ism-familiya, telefon, manzillar, joylashuvdan manzil aniqlash va coinlar
const User = require('../models/User');
const Address = require('../models/Address');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');
const { normalizePhone } = require('./startController');
const { LANGS } = require('../utils/i18n');

function fail(res, status, error) {
  return res.status(status).json({ error });
}

// ---------- PATCH /api/me ----------
async function updateMe(req, res) {
  try {
    const body = req.body || {};
    const fullName = String(body.fullName || '').trim().slice(0, 120);
    if (fullName.split(/\s+/).length < 2 || fullName.length < 5) return fail(res, 400, 'Ism va familiyani toʻliq kiriting');
    const phone = normalizePhone(body.phone);
    if (!phone) return fail(res, 400, 'Telefon raqam notoʻgʻri');
    const user = await User.updateContact(req.user.telegram_id, { fullName, phone });
    res.json({ fullName: user.full_name, phone: user.phone });
  } catch (err) {
    logger.error('PATCH /api/me xatosi', err);
    fail(res, 500, 'Profilni saqlab boʻlmadi');
  }
}

// ---------- PATCH /api/me/lang ----------
async function setLang(req, res) {
  const lang = String(req.body?.lang || '');
  if (!LANGS.includes(lang)) return fail(res, 400, 'Til notoʻgʻri');
  try {
    await User.setLang(req.user.telegram_id, lang);
    res.json({ lang });
  } catch (err) {
    logger.error('PATCH /api/me/lang xatosi', err);
    fail(res, 500, 'Tilni saqlab boʻlmadi');
  }
}

// ---------- PUT /api/me/avatar — profil rasmi (telefonda kichraytirilgan data-URL) ----------
const MAX_AVATAR_BYTES = 200 * 1024;

async function setAvatar(req, res) {
  try {
    const avatar = req.body?.avatar;
    if (avatar === null) {
      await User.setAvatar(req.user.telegram_id, null);
      return res.json({ avatar: '' });
    }
    if (typeof avatar !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar)) {
      return fail(res, 400, 'Rasm formati notoʻgʻri (JPEG, PNG yoki WebP)');
    }
    if (avatar.length > MAX_AVATAR_BYTES * 1.37) return fail(res, 400, 'Rasm juda katta');
    await User.setAvatar(req.user.telegram_id, avatar);
    res.json({ avatar });
  } catch (err) {
    logger.error('PUT /api/me/avatar xatosi', err);
    fail(res, 500, 'Rasmni saqlab boʻlmadi');
  }
}

// ---------- Manzillar ----------
function cleanAddress(body) {
  const text = (k, max) => String(body[k] ?? '').trim().slice(0, max);
  const address = text('address', 300);
  if (address.length < 5) throw new Error('Manzilni toʻliq kiriting (koʻcha, uy)');
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const lat = num(body.lat);
  const lng = num(body.lng);
  const validCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return {
    label: text('label', 20) || 'Uy',
    address,
    apartment: text('apartment', 20),
    entrance: text('entrance', 10),
    floor: text('floor', 10),
    note: text('note', 200),
    lat: validCoords ? lat : null,
    lng: validCoords ? lng : null,
    isDefault: Boolean(body.isDefault),
  };
}

async function listAddresses(req, res) {
  try {
    res.json(await Address.list(req.user.telegram_id));
  } catch (err) {
    logger.error('GET /api/addresses xatosi', err);
    fail(res, 500, 'Manzillarni yuklab boʻlmadi');
  }
}

async function createAddress(req, res) {
  try {
    let data;
    try {
      data = cleanAddress(req.body || {});
    } catch (e) {
      return fail(res, 400, e.message);
    }
    res.status(201).json(await Address.create(req.user.telegram_id, data));
  } catch (err) {
    if (/Koʻpi bilan/.test(err.message)) return fail(res, 400, err.message);
    logger.error('POST /api/addresses xatosi', err);
    fail(res, 500, 'Manzilni saqlab boʻlmadi');
  }
}

async function updateAddress(req, res) {
  try {
    let data;
    try {
      data = cleanAddress(req.body || {});
    } catch (e) {
      return fail(res, 400, e.message);
    }
    const a = await Address.update(req.user.telegram_id, Number(req.params.id), data);
    if (!a) return fail(res, 404, 'Manzil topilmadi');
    res.json(a);
  } catch (err) {
    logger.error('PATCH /api/addresses xatosi', err);
    fail(res, 500, 'Manzilni saqlab boʻlmadi');
  }
}

async function setDefaultAddress(req, res) {
  try {
    const a = await Address.setDefault(req.user.telegram_id, Number(req.params.id));
    if (!a) return fail(res, 404, 'Manzil topilmadi');
    res.json(a);
  } catch (err) {
    logger.error('POST /api/addresses/default xatosi', err);
    fail(res, 500, 'Saqlab boʻlmadi');
  }
}

async function removeAddress(req, res) {
  try {
    const ok = await Address.remove(req.user.telegram_id, Number(req.params.id));
    if (!ok) return fail(res, 404, 'Manzil topilmadi');
    res.json({ ok: true });
  } catch (err) {
    logger.error('DELETE /api/addresses xatosi', err);
    fail(res, 500, 'Oʻchirib boʻlmadi');
  }
}

// ---------- POST /api/geocode — koordinatadan manzil (OpenStreetMap Nominatim) ----------
async function reverseGeocode(req, res) {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return fail(res, 400, 'Koordinatalar notoʻgʻri');
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=uz,ru&lat=${lat}&lon=${lng}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'pizza-delivery-miniapp/1.0' },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.state || '';
    const district = a.city_district || a.suburb || a.county || '';
    const street = a.road || a.pedestrian || a.neighbourhood || a.residential || '';
    const house = a.house_number || '';
    const parts = [city, district, [street, house].filter(Boolean).join(', ')].filter(Boolean);
    const address = parts.length ? parts.join(', ') : data.display_name || '';
    res.json({ address, lat, lng });
  } catch (err) {
    logger.warn(`Geocode xatosi: ${err.message}`);
    fail(res, 502, 'Manzilni avtomatik aniqlab boʻlmadi — qoʻlda kiriting');
  }
}

// ---------- GET /api/coins ----------
async function getCoins(req, res) {
  try {
    const s = Settings.get();
    const history = await User.coinHistory(req.user.telegram_id, 30);
    res.json({
      enabled: s.coinsEnabled,
      perThousand: s.coinsPerThousand,
      balance: req.user.coins || 0,
      history: history.map((h) => ({
        amount: h.amount,
        type: h.type,
        orderId: h.order_id,
        note: h.note,
        createdAt: h.created_at,
      })),
    });
  } catch (err) {
    logger.error('GET /api/coins xatosi', err);
    fail(res, 500, 'Coin maʼlumotlarini yuklab boʻlmadi');
  }
}

module.exports = {
  setLang,
  setAvatar,
  updateMe,
  listAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  removeAddress,
  reverseGeocode,
  getCoins,
};
