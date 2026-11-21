'use client';

// Jonli fon: 4 fasl + "Pitsa yomg'iri" + "Pech uchqunlari".
// Tezlik uchun faqat CSS transform/opacity animatsiyalari (GPU), kam element, ilova fonga o'tsa — to'xtaydi.
import { useEffect, useMemo, useState } from 'react';
import { seasonNow, useThemeStore, type Wallpaper } from '@/store/themeStore';

type Kind = Exclude<Wallpaper, 'auto' | 'off'>;

const CONFIG: Record<Kind, { glyphs: string[]; count: number; motion: 'fall' | 'rise' | 'float'; size: [number, number]; speed: [number, number] }> = {
  spring: { glyphs: ['🌸', '🌸', '💮', '🌷'], count: 14, motion: 'fall', size: [16, 26], speed: [11, 19] },
  summer: { glyphs: ['', '', '', '🌼'], count: 12, motion: 'rise', size: [10, 26], speed: [12, 20] },
  autumn: { glyphs: ['🍁', '🍂', '🍁', '🍃'], count: 13, motion: 'fall', size: [18, 28], speed: [10, 17] },
  winter: { glyphs: ['❄️', '❅', '❆', '•'], count: 18, motion: 'fall', size: [10, 22], speed: [9, 16] },
  pizza: { glyphs: ['🍕', '🧀', '🍅', '🌿', '🍄', '🫒'], count: 12, motion: 'fall', size: [18, 30], speed: [12, 20] },
  embers: { glyphs: ['', '', '', ''], count: 16, motion: 'rise', size: [4, 9], speed: [7, 13] },
};

// Bir xil natija beradigan tasodifiy son (har ochilishda joylashuv o'zgarmasin)
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function LiveBackground() {
  const wallpaper = useThemeStore((s) => s.wallpaper);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    setReduced(Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const kind: Kind | null = wallpaper === 'off' ? null : wallpaper === 'auto' ? seasonNow() : wallpaper;

  const particles = useMemo(() => {
    if (!kind) return [];
    const c = CONFIG[kind];
    const r = rng(kind.length * 977 + 13);
    return Array.from({ length: c.count }, (_, i) => ({
      glyph: c.glyphs[i % c.glyphs.length],
      x: Math.round(r() * 100),
      size: Math.round(c.size[0] + r() * (c.size[1] - c.size[0])),
      dur: (c.speed[0] + r() * (c.speed[1] - c.speed[0])).toFixed(1),
      delay: (-r() * c.speed[1]).toFixed(1), // manfiy — darhol ekranda turgan holatdan boshlanadi
      drift: Math.round((r() - 0.5) * 120),
      spin: Math.round(180 + r() * 360) * (r() > 0.5 ? 1 : -1),
    }));
  }, [kind]);

  if (!kind || reduced) return kind ? <div className={`live-bg live-bg--${kind}`} aria-hidden="true" /> : null;

  const motion = CONFIG[kind].motion;

  return (
    <div className={`live-bg live-bg--${kind}${hidden ? ' is-paused' : ''}`} aria-hidden="true">
      {kind === 'summer' && <span className="live-bg__sun" />}
      {particles.map((p, i) => (
        <span
          key={i}
          className={`live-bg__p live-bg__p--${motion}${p.glyph ? '' : ' live-bg__p--dot'}`}
          style={
            {
              left: `${p.x}%`,
              fontSize: `${p.size}px`,
              width: p.glyph ? undefined : `${p.size}px`,
              height: p.glyph ? undefined : `${p.size}px`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}
