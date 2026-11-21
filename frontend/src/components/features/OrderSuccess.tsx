'use client';

// Buyurtma muvaffaqiyatli rasmiylashtirilgandan keyingi ekran
import Button from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = { orderId: number; total: number; paid: boolean; dineIn?: boolean; branch?: string; onClose: () => void };

export default function OrderSuccess({ orderId, total, paid, dineIn, branch, onClose }: Props) {
  const { t } = useT();
  return (
    <div className="success" role="alertdialog" aria-label={t('success_title')}>
      <div className="success__burst">✅</div>
      <h2 className="success__title">{t('success_title')}</h2>
      <div className="success__id">#{orderId}</div>
      <p className="success__text">
        {paid ? t('success_paid') : ''}
        {t('success_text', { sum: formatPrice(total) })}
        {branch ? <><br />🏪 {t('success_branch', { branch })}</> : null}
      </p>
      <div className="success__timeline">
        <span className="is-done">{t('tl_accepted')}</span>
        <span>{t('tl_cooking')}</span>
        <span>{dineIn ? t('tl_table') : t('tl_way')}</span>
      </div>
      <Button size="lg" block onClick={onClose}>
        {t('back_home')}
      </Button>
    </div>
  );
}
