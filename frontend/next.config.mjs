/** @type {import('next').NextConfig} */

// Backend (bot) manzili. Mini App /api/* so'rovlarini shu manzilga proksi qiladi,
// shuning uchun faqat frontendni HTTPS orqali ochish kifoya.
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '*.ngrok.app'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  // Sahifa (HTML) keshlanmasin — aks holda Telegram yangi versiya o'rniga eskisini ochadi.
  // JS/CSS fayllar nomida xesh bor, ular uzoq keshlanaveradi.
  async headers() {
    return [
      {
        source: '/',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
