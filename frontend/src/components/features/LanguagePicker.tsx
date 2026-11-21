'use client';

// Birinchi ochilishda til tanlash ekrani
import { useTelegram } from '@/hooks/useTelegram';
import { LANGS, translate, type Lang } from '@/lib/i18n';

type Props = { onPick: (lang: Lang) => void };

export default function LanguagePicker({ onPick }: Props) {
  const { haptic } = useTelegram();
  return (
    <div className="splash lang-picker">
      <div className="splash__bg" />
      <div className="splash__shade" />
      <div className="splash__content">
        <div className="splash__logo">
          AYDE<em>PIZZA</em>
        </div>
        <div className="lang-picker__titles">
          <b>{translate('uz', 'choose_lang')}</b>
          <span>{translate('ru', 'choose_lang')}</span>
          <span>{translate('en', 'choose_lang')}</span>
        </div>
        <div className="lang-picker__list">
          {LANGS.map((l) => (
            <button
              key={l.id}
              className="lang-picker__btn"
              onClick={() => {
                haptic.impact('medium');
                onPick(l.id);
              }}
            >
              <span className="lang-picker__flag">{l.flag}</span>
              <span>{l.label}</span>
              <span className="lang-picker__arrow">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
