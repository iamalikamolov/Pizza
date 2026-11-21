'use client';

// Mini App yuklanganini tekshiruvchi provayder
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { TelegramContext, type TelegramContextValue, type TelegramWebApp } from '@/hooks/useTelegram';
import { useT } from '@/lib/i18n';
import LiveBackground from '@/components/layout/LiveBackground';
import Splash from '@/components/ui/Splash';

const BRAND_BG = { light: '#F6EEE4', dark: '#1A1210' };

function waitForWebApp(timeoutMs = 2500): Promise<TelegramWebApp | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const wa = window.Telegram?.WebApp;
      if (wa) return resolve(wa);
      if (Date.now() - started > timeoutMs) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
}

export default function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const { lang } = useT();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    let themeHandler: (() => void) | null = null;

    waitForWebApp().then((wa) => {
      if (cancelled) return;
      // initData bo'sh bo'lsa — ilova Telegram'dan tashqarida (oddiy brauzerda) ochilgan
      const inTelegram = Boolean(wa && wa.initData);

      const applyTheme = () => {
        // Brend dizayni har doim yorug' (krem/qizil) — Telegram qorong'i rejimida ham
        const scheme: 'light' | 'dark' = 'light';
        setColorScheme(scheme);
        document.documentElement.dataset.theme = scheme;
        if (inTelegram && wa) {
          try {
            wa.setHeaderColor(BRAND_BG[scheme]);
            wa.setBackgroundColor(BRAND_BG[scheme]);
            wa.setBottomBarColor?.(BRAND_BG[scheme]);
          } catch {
            // eski Telegram versiyalari
          }
        }
      };

      if (wa && inTelegram) {
        wa.ready();
        wa.expand();
        if (wa.isVersionAtLeast('7.7')) wa.disableVerticalSwipes?.();
        themeHandler = applyTheme;
        wa.onEvent('themeChanged', themeHandler);
        setWebApp(wa);
      }
      applyTheme();
      setIsReady(true);
    });

    return () => {
      cancelled = true;
      if (themeHandler) window.Telegram?.WebApp?.offEvent('themeChanged', themeHandler);
    };
  }, []);

  const value = useMemo<TelegramContextValue>(() => {
    const hf = webApp?.isVersionAtLeast('6.1') ? webApp.HapticFeedback : null;
    return {
      webApp,
      user: webApp?.initDataUnsafe?.user ?? null,
      isTelegram: Boolean(webApp),
      isReady,
      colorScheme,
      haptic: {
        impact: (style = 'light') => hf?.impactOccurred(style),
        notify: (type) => hf?.notificationOccurred(type),
        select: () => hf?.selectionChanged(),
      },
    };
  }, [webApp, isReady, colorScheme]);

  return (
    <TelegramContext.Provider value={value}>
      {isReady ? (
        <>
          <LiveBackground />
          {children}
        </>
      ) : (
        <Splash />
      )}
    </TelegramContext.Provider>
  );
}
