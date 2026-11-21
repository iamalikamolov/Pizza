'use client';

// To'lov usullari
import type { PaymentMethod, PaymentMethodId } from '@/lib/api';
import { useTelegram } from '@/hooks/useTelegram';
import { cn, formatStars } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = {
  methods: PaymentMethod[];
  value: PaymentMethodId;
  onChange: (id: PaymentMethodId) => void;
  totalStars: number;
};

export default function PaymentMethods({ methods, value, onChange, totalStars }: Props) {
  const { haptic } = useTelegram();
  const { t } = useT();
  return (
    <div className="pay-methods" role="radiogroup" aria-label={t('pay_method')}>
      {methods.map((m) => (
        <button
          key={m.id}
          role="radio"
          aria-checked={value === m.id}
          disabled={!m.enabled}
          className={cn('pay', value === m.id && 'is-active')}
          onClick={() => {
            haptic.select();
            onChange(m.id);
          }}
        >
          <span className="pay__emoji">{m.emoji}</span>
          <span className="pay__title">{m.title}</span>
          <span className="pay__sub">
            {!m.enabled ? t('soon') : m.id === 'stars' ? `≈ ${formatStars(totalStars)}` : m.subtitle}
          </span>
          <span className="pay__radio" />
        </button>
      ))}
    </div>
  );
}
