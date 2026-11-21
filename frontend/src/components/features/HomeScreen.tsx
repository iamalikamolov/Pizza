'use client';

// 2-bosqich: asosiy sahifa — header, manzil, storislar, reklama karuseli, kategoriyalar, ommabop, pastki banner
import AddressBar from '@/components/features/AddressBar';
import HeroWidget from '@/components/features/HeroWidget';
import ProductCard from '@/components/features/ProductCard';
import Stories from '@/components/features/Stories';
import Header from '@/components/layout/Header';
import Icon from '@/components/ui/Icon';
import type { Address, Banner, Catalog, Product } from '@/lib/api';
import { cn, formatPrice, thumb } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = {
  catalog: Catalog;
  cartCount: number;
  ordersCount?: number;
  qtyOf: (id: string) => number;
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product) => void;
  onGoCatalog: (category?: string, focusSearch?: boolean) => void;
  onGoCart: () => void;
  onGoProfile: () => void;
  onAction: (action: string) => void; // storis tugmalari
  onBanner: (banner: Banner) => void; // reklama bosilganda
  avatar?: string;
  addresses: Address[];
  selectedAddress: Address | null;
  onSelectAddress: (a: Address) => void;
  onAddressesChanged: () => void;
};

export default function HomeScreen(props: Props) {
  const { catalog, qtyOf, onOpenProduct, onAdd, onGoCatalog, onAction } = props;
  const { t } = useT();
  const popular = [...catalog.products].sort((a, b) => b.rating - a.rating || a.price - b.price).slice(0, 6);
  const heroBanners = (catalog.banners || []).filter((b) => b.placement === 'hero');
  const bottomBanner = (catalog.banners || []).find((b) => b.placement === 'bottom');

  return (
    <div className="screen screen--home">
      <Header
        brandName={catalog.brand.name}
        slogan={catalog.brand.slogan}
        cartCount={props.cartCount}
        ordersCount={props.ordersCount}
        avatar={props.avatar}
        onProfileClick={props.onGoProfile}
        onCartClick={props.onGoCart}
      />

      <AddressBar
        addresses={props.addresses}
        selected={props.selectedAddress}
        onSelect={props.onSelectAddress}
        onChanged={props.onAddressesChanged}
        onSearch={() => onGoCatalog('all', true)}
      />

      <Stories stories={catalog.stories} onAction={onAction} />

      <HeroWidget
        banners={heroBanners}
        intervalSec={catalog.settings?.bannerInterval || 5}
        onAction={props.onBanner}
        onCatalog={() => onGoCatalog('all')}
      />

      {/* Kategoriyalar */}
      <div className="cat-tiles">
        {catalog.categories.map((c, i) => (
          <button key={c.id} className={cn('cat-tile glass', i === 0 && 'is-active')} onClick={() => onGoCatalog(c.id)}>
            <span className="cat-tile__icon">{c.emoji}</span>
            <span className="cat-tile__label">{c.title}</span>
          </button>
        ))}
      </div>

      {/* Ommabop */}
      <div className="section-head">
        <h3 className="section-title">{t('popular')}</h3>
        <button className="section-link" onClick={() => onGoCatalog('all')}>
          {t('view_all')} <Icon name="arrow" size={15} />
        </button>
      </div>
      <div className="h-scroll">
        {popular.map((p) => (
          <ProductCard key={p.id} product={p} qty={qtyOf(p.id)} onOpen={() => onOpenProduct(p)} onAdd={() => onAdd(p)} />
        ))}
      </div>

      {/* Pastki reklama banneri */}
      {bottomBanner && (
        <section className={cn('promo glass', `theme-${bottomBanner.theme}`)} onClick={() => props.onBanner(bottomBanner)}>
          <div className="promo__media">
            <img src={thumb(bottomBanner.image)} alt="" />
            <span className="promo__ring" />
          </div>
          <div className="promo__body">
            {bottomBanner.kicker && <span className="promo__kicker">{bottomBanner.kicker}</span>}
            <h3 className="promo__title">{bottomBanner.title}</h3>
            {bottomBanner.subtitle && <p className="promo__text">{bottomBanner.subtitle}</p>}
          </div>
          <button
            className="promo__cta"
            onClick={(e) => {
              e.stopPropagation();
              props.onBanner(bottomBanner);
            }}
          >
            {bottomBanner.ctaLabel}
          </button>
        </section>
      )}

      {/* Ishonch bloki */}
      <div className="trust">
        <div className="trust__item glass">
          <span className="trust__icon">♨️</span>
          <b>{t('trust_hot')}</b>
          <small>{t('trust_hot_s')}</small>
        </div>
        <div className="trust__item glass">
          <span className="trust__icon">⏱</span>
          <b>{t('trust_time')}</b>
          <small>{t('trust_time_s')}</small>
        </div>
        <div className="trust__item glass">
          <span className="trust__icon">⭐️</span>
          <b>{t('trust_rate')}</b>
          <small>{t('trust_rate_s')}</small>
        </div>
      </div>
      <p className="free-note">🚚 {t('free_from', { sum: formatPrice(catalog.delivery.freeFrom) })}</p>
    </div>
  );
}
