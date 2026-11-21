'use client';

// Reklama bannerining "batafsil" sahifasi (admin "Batafsil sahifa" harakatini tanlaganda)
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import type { Banner } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = { banner: Banner | null; onClose: () => void; onOrder: () => void };

export default function BannerDetails({ banner, onClose, onOrder }: Props) {
  const { t } = useT();
  return (
    <BottomSheet
      open={Boolean(banner)}
      onClose={onClose}
      title={banner?.kicker || t('promo_default')}
      footer={
        <Button size="lg" block onClick={onOrder}>
          {t('order_now')}
        </Button>
      }
    >
      {banner && (
        <>
          <div className={cn('banner-details__hero', `theme-${banner.theme}`)}>
            <img src={banner.image} alt="" />
            <div>
              <h2>{banner.title}</h2>
              {banner.subtitle && <p>{banner.subtitle}</p>}
            </div>
          </div>
          {banner.details ? (
            <div className="banner-details__text">
              {banner.details.split('\n').map((line, i) => (line.trim() ? <p key={i}>{line}</p> : <br key={i} />))}
            </div>
          ) : (
            <p className="muted">{t('promo_more_soon')}</p>
          )}
        </>
      )}
    </BottomSheet>
  );
}
