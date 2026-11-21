// Asosiy karkas va shriftlar
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import TelegramProvider from '@/providers/TelegramProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Ayde Pizza — issiq pitsa 30 daqiqada',
  description: 'Telegram ichida pitsa buyurtma qiling: chegirmalar, tezkor yetkazish va qulay toʻlov.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F6EEE4',
};

// Shriftlar brauzerda yuklanadi (display=swap — matn darhol ko'rinadi, shrift kelgach almashadi)
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Inter:wght@400;500;600;700;800&family=Oswald:wght@500;600;700&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
        {/* Yuklanish ekrani foni darhol tayyor bo'lsin */}
        <link rel="preload" as="image" href="/images/thumbs/hero-bg.jpg" />
        <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="beforeInteractive" />
      </head>
      <body>
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
