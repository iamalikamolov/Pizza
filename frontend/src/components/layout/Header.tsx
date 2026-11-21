'use client';

// Tepa qism: logotip, savatcha, profil va mijozning ismi bilan xush kelibsiz matni
import Icon from '@/components/ui/Icon';
import { useTelegram } from '@/hooks/useTelegram';
import { useT, type TKey } from '@/lib/i18n';

function greetingKey(): TKey {
  const h = new Date().getHours();
  if (h < 5) return 'gr_night';
  if (h < 12) return 'gr_morning';
  if (h < 18) return 'gr_day';
  return 'gr_evening';
}

type Props = {
  brandName: string;
  slogan: string;
  cartCount: number;
  ordersCount?: number;
  avatar?: string;
  onProfileClick: () => void;
  onCartClick: () => void;
};

export default function Header({ brandName, slogan, cartCount, ordersCount = 0, avatar, onProfileClick, onCartClick }: Props) {
  const { user } = useTelegram();
  const { t } = useT();
  const name = user?.first_name || t('guest');
  const [first, ...rest] = brandName.split(' ');
  const photo = avatar || user?.photo_url;

  return (
    <header className="header">
      <div className="topbar">
        <div className="logo">
          <span className="logo__name">
            {first}
            {rest.length > 0 && <em>{rest.join(' ')}</em>}
          </span>
          <span className="logo__tag">{slogan}</span>
        </div>

        <div className="topbar__actions">
          <button className="icon-btn glass" onClick={onCartClick} aria-label={t('nav_cart')}>
            <Icon name="cart" size={21} />
            {cartCount > 0 && (
              <span key={cartCount} className="icon-btn__badge">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
          <button className="icon-btn glass avatar-btn" onClick={onProfileClick} aria-label={t('nav_profile')}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" />
            ) : (
              <Icon name="user" size={21} />
            )}
          </button>
        </div>
      </div>

      <div className="greeting">
        {t(greetingKey())}, <b>{name}</b> 👋 <span>{ordersCount > 0 ? t('hdr_back') : t('hdr_new')}</span>
      </div>
    </header>
  );
}
