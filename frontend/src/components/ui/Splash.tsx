'use client';

// Yuklanish ekrani: brend foni (jonli pitsa rasmi) + aylana bo'lib yonuvchi 6 ta pitsa bo'lagi
import { useT } from '@/lib/i18n';

// Bitta bo'lak: markazdan (60,60) tepaga qaragan 60° lik uchburchak-yoy
const SLICE = 'M60 60 L35 16.7 A50 50 0 0 1 85 16.7 Z';

export function PizzaLoader({ size = 120 }: { size?: number }) {
  return (
    <svg className="pizza-loader" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 60} 60 60)`}>
          <g className="pizza-loader__slice" style={{ animationDelay: `${i * 0.16}s` }}>
            <path d={SLICE} fill="#ffcf6b" />
            <path d="M35 16.7 A50 50 0 0 1 85 16.7" fill="none" stroke="#d98a3a" strokeWidth="7" strokeLinecap="round" />
            <circle cx="60" cy="31" r="5.2" fill="#d7372a" />
            <circle cx="54" cy="45" r="3.6" fill="#d7372a" />
            <circle cx="66.5" cy="44" r="3.2" fill="#d7372a" />
            <circle cx="49" cy="30" r="1.6" fill="#3f8c3a" />
          </g>
        </g>
      ))}
    </svg>
  );
}

export default function Splash() {
  const { t } = useT();
  return (
    <div className="splash" role="status" aria-label={t('loading')}>
      <div className="splash__bg" />
      <div className="splash__shade" />
      <div className="splash__content">
        <div className="splash__logo">
          AYDE<em>PIZZA</em>
        </div>
        <PizzaLoader />
        <div className="splash__text">{t('loading')}</div>
      </div>
    </div>
  );
}
