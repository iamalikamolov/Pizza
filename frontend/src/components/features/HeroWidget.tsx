'use client';

// Bosh sahifadagi asosiy vidjet: reklama bannerlari karuseli (uzluksiz loop, admin paneldan boshqariladi)
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import type { Banner } from '@/lib/api';
import { cn, thumb } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = {
  banners: Banner[];
  intervalSec: number;
  onAction: (banner: Banner) => void;
  onCatalog: () => void;
};

export default function HeroWidget({ banners, intervalSec, onAction, onCatalog }: Props) {
  const { t } = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);
  const n = banners.length;
  const loop = n > 1;

  // Loop uchun: [oxirgi nusxa, ...bannerlar, birinchi nusxa]
  const slides = loop ? [banners[n - 1], ...banners, banners[0]] : banners;

  const width = () => trackRef.current?.clientWidth || 1;
  const jump = (i: number) => trackRef.current?.scrollTo({ left: i * width(), behavior: 'instant' as ScrollBehavior });
  const glide = (i: number) => trackRef.current?.scrollTo({ left: i * width(), behavior: 'smooth' });

  // Boshlang'ich holat — haqiqiy birinchi banner (nusxadan keyin)
  useEffect(() => {
    if (loop) requestAnimationFrame(() => jump(1));
  }, [loop, n]);

  // Avtomatik aylanish
  useEffect(() => {
    if (!loop) return;
    const t = setInterval(() => {
      const el = trackRef.current;
      if (!el || Date.now() < pausedUntil.current || document.hidden) return;
      glide(Math.round(el.scrollLeft / width()) + 1);
    }, Math.max(2, intervalSec) * 1000);
    return () => clearInterval(t);
  }, [loop, intervalSec]);

  // Nusxaga yetganda — sezdirmasdan haqiqiy slaydga sakraymiz
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const pos = Math.round(el.scrollLeft / width());
    setActive(loop ? (pos - 1 + n) % n : pos);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const p = Math.round(el.scrollLeft / width());
      if (!loop) return;
      if (p === 0) jump(n);
      else if (p === n + 1) jump(1);
    }, 120);
  }, [loop, n]);

  const goTo = (i: number) => {
    pausedUntil.current = Date.now() + intervalSec * 2000;
    glide(loop ? i + 1 : i);
  };

  if (!n) return null;

  return (
    <section className="hero" aria-roledescription="karusel" aria-label="Takliflar">
      <div
        className="hero__track"
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={() => (pausedUntil.current = Date.now() + intervalSec * 2000)}
      >
        {slides.map((b, i) => (
          <article
            key={`${b.id}-${i}`}
            className={cn('hero__slide', `theme-${b.theme}`)}
            onClick={() => onAction(b)}
            role="button"
            tabIndex={-1}
            aria-label={b.title}
          >
            <img className="hero__img" src={thumb(b.image)} alt="" loading={i <= 1 ? 'eager' : 'lazy'} />
            <div className="hero__shade" />
            <div className="hero__glare" />
            <div className="hero__content">
              {b.kicker && <span className="hero__kicker">{b.kicker}</span>}
              <h2 className="hero__title">{b.title}</h2>
              {b.subtitle && <p className="hero__text">{b.subtitle}</p>}
              <div className="hero__actions">
                <button
                  className="glass-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(b);
                  }}
                >
                  {b.ctaLabel}
                  <Icon name="arrow" size={16} strokeWidth={2.4} />
                </button>
                <button
                  className="hero__link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCatalog();
                  }}
                >
                  {t('see_catalog')}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {n > 1 && (
        <div className="hero__dots">
          {banners.map((b, i) => (
            <button key={b.id} className={cn('hero__dot', i === active && 'is-active')} onClick={() => goTo(i)} aria-label={`${i + 1}-banner`} />
          ))}
        </div>
      )}
    </section>
  );
}
