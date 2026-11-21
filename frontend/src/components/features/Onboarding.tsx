'use client';

// 1-bosqich: 3 slaydli onboarding (faqat bir marta ko'rsatiladi). Tepada til tanlash
import { Fragment, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { useTelegram } from '@/hooks/useTelegram';
import { LANGS, useLangStore, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = { onFinish: () => void; onLangChange?: (lang: 'uz' | 'ru' | 'en') => void };

const SLIDES = 3;

// "<a>...</a>" ichidagi matnni ajratib ko'rsatadi
function Rich({ text }: { text: string }) {
  const parts = text.split(/<a>|<\/a>/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <span key={i} className="accent">{p}</span> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

export default function Onboarding({ onFinish, onLangChange }: Props) {
  const { haptic } = useTelegram();
  const { t, lang } = useT();
  const setLang = useLangStore((s) => s.setLang);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) {
      setIndex(i);
      haptic.select();
    }
  };

  const isLast = index === SLIDES - 1;

  return (
    <div className="onboarding">
      <div className="onboarding__langs">
        {LANGS.map((l) => (
          <button
            key={l.id}
            className={cn('onboarding__lang', lang === l.id && 'is-active')}
            onClick={() => {
              setLang(l.id);
              onLangChange?.(l.id);
            }}
          >
            {l.flag} {l.id.toUpperCase()}
          </button>
        ))}
      </div>
      <button className="onboarding__skip" onClick={onFinish}>
        {t('ob_skip')}
      </button>

      <div className="onboarding__track" ref={trackRef} onScroll={onScroll}>
        {/* Slayd 1 — Muammo va yechim */}
        <section className="slide">
          <div className="slide__art art-problem">
            <img className="art-problem__pizza" src="/images/onboarding.jpg" alt="" />
            <div className="chip chip--bad chip--a">{t('ob_chip1')}</div>
            <div className="chip chip--bad chip--b">{t('ob_chip2')}</div>
            <div className="chip chip--good chip--c">{t('ob_chip3')}</div>
            <div className="art-problem__scooter">🛵</div>
          </div>
          <h1 className="slide__title">
            <Rich text={t('ob1_title')} />
          </h1>
          <p className="slide__text">{t('ob1_text')}</p>
        </section>

        {/* Slayd 2 — Qanday qilib? */}
        <section className="slide">
          <div className="slide__art art-steps">
            {(
              [
                [1, '🍕', 'ob_s1', 'ob_s1t'],
                [2, '💳', 'ob_s2', 'ob_s2t'],
                [3, '🛵', 'ob_s3', 'ob_s3t'],
              ] as const
            ).map(([n, icon, title, text]) => (
              <div className="step" key={n} style={{ animationDelay: `${n * 90}ms` }}>
                <div className="step__num">{n}</div>
                <div className="step__icon">{icon}</div>
                <div>
                  <div className="step__title">{t(title)}</div>
                  <div className="step__text">{t(text)}</div>
                </div>
              </div>
            ))}
          </div>
          <h1 className="slide__title">
            <Rich text={t('ob2_title')} />
          </h1>
          <p className="slide__text">{t('ob2_text')}</p>
        </section>

        {/* Slayd 3 — Ijtimoiy isbot va harakat */}
        <section className="slide">
          <div className="slide__art art-proof">
            <div className="art-proof__avatars">
              {['🧑🏻', '👩🏻', '👨🏽', '👩🏼‍🦱', '🧔🏻'].map((a, i) => (
                <span key={i} style={{ zIndex: 10 - i }}>
                  {a}
                </span>
              ))}
            </div>
            <div className="art-proof__number">10 000+</div>
            <div className="art-proof__label">{t('ob_customers')}</div>
            <div className="art-proof__rating">
              <span className="stars">★★★★★</span> <b>4.9</b> · {t('ob_reviews')}
            </div>
            <blockquote className="art-proof__quote">{t('ob_quote')}</blockquote>
          </div>
          <h1 className="slide__title">
            <Rich text={t('ob3_title')} />
          </h1>
          <p className="slide__text">{t('ob3_text')}</p>
        </section>
      </div>

      <div className="onboarding__bottom">
        <div className="dots">
          {Array.from({ length: SLIDES }).map((_, i) => (
            <button key={i} className={cn('dot', i === index && 'is-active')} onClick={() => goTo(i)} aria-label={`${i + 1}`} />
          ))}
        </div>
        <Button
          size="lg"
          block
          onClick={() => {
            haptic.impact('medium');
            if (isLast) onFinish();
            else goTo(index + 1);
          }}
        >
          {isLast ? t('ob_start') : t('ob_next')}
        </Button>
      </div>
    </div>
  );
}
