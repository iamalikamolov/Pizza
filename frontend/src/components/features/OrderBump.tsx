'use client';

// Order Bump — bitta switch bilan qo'shimcha savdo
import Switch from '@/components/ui/Switch';
import type { OrderBump as OrderBumpType } from '@/lib/api';
import { cn, formatPrice } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = { bump: OrderBumpType; checked: boolean; onChange: (v: boolean) => void };

export default function OrderBump({ bump, checked, onChange }: Props) {
  const { t } = useT();
  const [before, after] = t('bump_text').split('{title}');
  const [mid, end] = (after || '').split('{price}');
  return (
    <div className={cn('bump', checked && 'bump--on')} onClick={() => onChange(!checked)} role="group">
      <div className="bump__icon">🥤</div>
      <div className="bump__body">
        <div className="bump__kicker">{t('bump_kicker')}</div>
        <div className="bump__title">
          {before}
          <b>{bump.title}</b>
          {mid}
          <span className="bump__price">{formatPrice(bump.price)}</span>
          {end}
        </div>
        <div className="bump__desc">
          {bump.description}. {t('you_save', { sum: formatPrice(bump.oldPrice - bump.price) })}
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} label={t('extra_offer')} />
    </div>
  );
}
