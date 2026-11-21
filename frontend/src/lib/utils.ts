// Yordamchi funksiyalar
import { currentLang, translate } from '@/lib/i18n';

/** 69000 -> "69 000 soʻm" */
export function formatPrice(value: number, withCurrency = true): string {
  const n = Math.round(value || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return withCurrency ? `${n} ${translate(currentLang(), 'sum')}` : n;
}

export function formatStars(value: number): string {
  return `${Math.round(value).toLocaleString('en-US').replace(/,/g, ' ')} ⭐️`;
}

export function discountPercent(oldPrice: number, price: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Faqat raqamlarni qoldiradi va +998 XX XXX XX XX ko'rinishida formatlaydi */
export function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (!digits.startsWith('998')) digits = '998' + digits.replace(/^998?/, '');
  digits = digits.slice(0, 12);
  const p = digits.slice(3);
  let out = '+998';
  if (p.length > 0) out += ' ' + p.slice(0, 2);
  if (p.length > 2) out += ' ' + p.slice(2, 5);
  if (p.length > 5) out += ' ' + p.slice(5, 7);
  if (p.length > 7) out += ' ' + p.slice(7, 9);
  return out;
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('998');
}

export function pluralItems(count: number): string {
  return `${count} ta`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** localStorage ga xavfsiz murojaat (Telegram WebView'da ba'zan taqiqlangan bo'ladi) */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // e'tiborsiz qoldiramiz
    }
  },
};

/** Rasmni telefonda kichraytiradi (uzun tomoni maxSide px), JPEG data-URL qaytaradi */
export function resizeToDataUrl(file: File, maxSide = 1080, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

// Kartalar va ro'yxatlar uchun kichik (~20 KB) rasm nusxasi
const THUMBS = new Set(['pepperoni', 'margarita', 'four-cheese', 'bbq-chicken', 'meat-lovers', 'truffle', 'hawaii', 'veggie', 'promo', 'hero']);

export function thumb(src: string): string {
  const m = /^\/images\/([\w-]+)\.jpg$/.exec(src || '');
  if (!m || !THUMBS.has(m[1])) return src;
  return `/images/thumbs/${m[1] === 'hero' ? 'hero-bg' : m[1]}.jpg`;
}
