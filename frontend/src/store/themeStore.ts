// Jonli fon tanlovi (har bir foydalanuvchining o'z qurilmasida saqlanadi)
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Wallpaper = 'auto' | 'spring' | 'summer' | 'autumn' | 'winter' | 'pizza' | 'embers' | 'off';

export const WALLPAPERS: Array<{ id: Wallpaper; emoji: string }> = [
  { id: 'auto', emoji: '🗓' },
  { id: 'spring', emoji: '🌸' },
  { id: 'summer', emoji: '☀️' },
  { id: 'autumn', emoji: '🍁' },
  { id: 'winter', emoji: '❄️' },
  { id: 'pizza', emoji: '🍕' },
  { id: 'embers', emoji: '🔥' },
  { id: 'off', emoji: '⏸' },
];

/** Hozirgi oyga qarab fasl */
export function seasonNow(d = new Date()): Exclude<Wallpaper, 'auto' | 'pizza' | 'embers' | 'off'> {
  const m = d.getMonth(); // 0 — yanvar
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

type ThemeState = { wallpaper: Wallpaper; setWallpaper: (w: Wallpaper) => void };

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      wallpaper: 'auto',
      setWallpaper: (wallpaper) => set({ wallpaper }),
    }),
    { name: 'pizza-wallpaper', storage: createJSONStorage(() => localStorage) }
  )
);
