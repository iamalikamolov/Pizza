'use client';

// window.Telegram.WebApp obyekti uchun hook va tiplar
import { createContext, useContext } from 'react';

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

type HapticImpact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe: { user?: TelegramUser; start_param?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast: (version: string) => boolean;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  openInvoice: (url: string, callback?: (status: InvoiceStatus) => void) => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (ok: boolean) => void) => void;
  requestContact?: (
    callback?: (
      shared: boolean,
      response?: { status: string; responseUnsafe?: { contact?: { phone_number: string; first_name?: string; last_name?: string } } }
    ) => void
  ) => void;
  LocationManager?: {
    isInited: boolean;
    isLocationAvailable: boolean;
    isAccessGranted: boolean;
    init: (cb?: () => void) => void;
    getLocation: (cb: (data: { latitude: number; longitude: number } | null) => void) => void;
    openSettings: () => void;
  };
  onEvent: (event: string, handler: (...args: unknown[]) => void) => void;
  offEvent: (event: string, handler: (...args: unknown[]) => void) => void;
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: HapticImpact) => void;
    notificationOccurred: (type: HapticNotification) => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    getItem: (key: string, cb: (err: string | null, value?: string) => void) => void;
    setItem: (key: string, value: string, cb?: (err: string | null, ok?: boolean) => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export type TelegramContextValue = {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  isTelegram: boolean;
  isReady: boolean;
  colorScheme: 'light' | 'dark';
  haptic: {
    impact: (style?: HapticImpact) => void;
    notify: (type: HapticNotification) => void;
    select: () => void;
  };
};

export const TelegramContext = createContext<TelegramContextValue | null>(null);

export function useTelegram(): TelegramContextValue {
  const ctx = useContext(TelegramContext);
  if (!ctx) throw new Error('useTelegram faqat TelegramProvider ichida ishlatiladi');
  return ctx;
}

/**
 * Telegram BackButton ni ochiq oynalar (sheet/story/admin) uchun boshqaradi.
 * Oynalar ichma-ich ochilishi mumkin, shuning uchun stek ishlatiladi: tugma eng yuqoridagi oynani yopadi.
 */
const backStack: Array<() => void> = [];
let backListener: (() => void) | null = null;

export function bindBackButton(webApp: TelegramWebApp | null, onBack: () => void): () => void {
  const bb = webApp?.BackButton;
  if (!bb || !webApp?.isVersionAtLeast?.('6.1')) return () => {};
  if (!backListener) {
    backListener = () => backStack[backStack.length - 1]?.();
    bb.onClick(backListener);
  }
  backStack.push(onBack);
  bb.show();
  return () => {
    const i = backStack.lastIndexOf(onBack);
    if (i >= 0) backStack.splice(i, 1);
    if (backStack.length === 0) bb.hide();
  };
}
