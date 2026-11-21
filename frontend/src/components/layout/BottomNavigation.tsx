'use client';

// Pastki menyu: Bosh sahifa | Katalog | (Savatcha) | Bonuslar | Profil
import Icon, { type IconName } from '@/components/ui/Icon';
import { useTelegram } from '@/hooks/useTelegram';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Tab = 'home' | 'catalog' | 'cart' | 'rewards' | 'profile';

type Props = { active: Tab; onChange: (tab: Tab) => void; cartCount: number; coinsEnabled: boolean };

export default function BottomNavigation({ active, onChange, cartCount, coinsEnabled }: Props) {
  const { haptic } = useTelegram();
  const { t } = useT();

  const tabs: Array<{ id: Tab; label: string; icon: IconName }> = [
    { id: 'home', label: t('nav_home'), icon: 'home' },
    { id: 'catalog', label: t('nav_catalog'), icon: 'grid' },
    { id: 'cart', label: t('nav_cart'), icon: 'cart' },
    { id: 'rewards', label: coinsEnabled ? t('nav_bonus') : t('nav_promos'), icon: coinsEnabled ? 'gift' : 'tag' },
    { id: 'profile', label: t('nav_profile'), icon: 'user' },
  ];

  const go = (id: Tab) => {
    if (id !== active) haptic.select();
    onChange(id);
  };

  return (
    <nav className="bottom-nav" aria-label="Menu">
      {tabs.map((tab) =>
        tab.id === 'cart' ? (
          <button
            key={tab.id}
            className={cn('bottom-nav__cart', active === 'cart' && 'is-active')}
            onClick={() => go('cart')}
            aria-label={`${tab.label}${cartCount ? ` (${cartCount})` : ''}`}
            aria-current={active === 'cart' ? 'page' : undefined}
          >
            <Icon name="cart" size={26} strokeWidth={2.1} />
            {cartCount > 0 && (
              <span key={cartCount} className="bottom-nav__badge">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        ) : (
          <button
            key={tab.id}
            className={cn('bottom-nav__item', active === tab.id && 'is-active')}
            onClick={() => go(tab.id)}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            <span className="bottom-nav__icon">
              <Icon name={tab.icon} size={22} strokeWidth={active === tab.id ? 2.2 : 1.9} />
            </span>
            <span className="bottom-nav__label">{tab.label}</span>
          </button>
        )
      )}
    </nav>
  );
}
