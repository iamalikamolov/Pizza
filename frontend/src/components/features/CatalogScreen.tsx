'use client';

// 3-bosqich: katalog — menyu ko'rinishi (bo'limlar), qidiruv, saralash va mahsulot kartochkalari.
// Oddiy holatda: har bir kategoriya — alohida bo'lim; yorliq bosilsa o'sha bo'limga o'tadi.
// Qidiruv yoki saralash yoqilsa: bitta tekis ro'yxat.
import { useEffect, useMemo, useRef, useState } from 'react';
import ProductCard from '@/components/features/ProductCard';
import BottomSheet from '@/components/ui/BottomSheet';
import Icon from '@/components/ui/Icon';
import SearchBar from '@/components/ui/SearchBar';
import { useTelegram } from '@/hooks/useTelegram';
import type { Catalog, Product } from '@/lib/api';
import { useT, type TKey } from '@/lib/i18n';
import { cn, discountPercent, formatPrice } from '@/lib/utils';

type SortId = 'popular' | 'cheap' | 'expensive' | 'discount';

const SORTS: Array<{ id: SortId; title: TKey }> = [
  { id: 'popular', title: 'sort_popular' },
  { id: 'cheap', title: 'sort_cheap' },
  { id: 'expensive', title: 'sort_expensive' },
  { id: 'discount', title: 'sort_discount' },
];

type Props = {
  catalog: Catalog;
  category: string;
  onCategoryChange: (id: string) => void;
  qtyOf: (id: string) => number;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
  cartCount: number;
  cartTotal: number;
  onGoCart: () => void;
  autoFocusSearch?: boolean;
};

const SECTION_OFFSET = 70; // yopishqoq yorliqlar balandligi

export default function CatalogScreen(props: Props) {
  const { catalog, category, onCategoryChange, qtyOf, onOpen, onAdd, cartCount, cartTotal, onGoCart } = props;
  const { haptic } = useTelegram();
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortId>('popular');
  const [sortOpen, setSortOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const chipsRef = useRef<HTMLDivElement>(null);
  const scrollingTo = useRef(0);

  const menuMode = !query.trim() && sort === 'popular';

  // Menyu bo'limlari (bo'sh bo'limlar ko'rsatilmaydi)
  const sections = useMemo(
    () =>
      catalog.categories
        .filter((c) => c.id !== 'all')
        .map((c) => ({ ...c, products: catalog.products.filter((p) => p.categories.includes(c.id)) }))
        .filter((s) => s.products.length > 0),
    [catalog]
  );

  // Qidiruv / saralash rejimi uchun tekis ro'yxat
  const flat = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = catalog.products.filter(
      (p) =>
        (category === 'all' || p.categories.includes(category)) &&
        (!q || `${p.name} ${p.description} ${p.ingredients.join(' ')}`.toLowerCase().includes(q))
    );
    const sorters: Record<SortId, (a: Product, b: Product) => number> = {
      popular: (a, b) => b.rating - a.rating,
      cheap: (a, b) => a.price - b.price,
      expensive: (a, b) => b.price - a.price,
      discount: (a, b) => discountPercent(b.oldPrice, b.price) - discountPercent(a.oldPrice, a.price),
    };
    return [...list].sort(sorters[sort]);
  }, [catalog.products, category, query, sort]);

  const scrollToSection = (id: string, smooth = true) => {
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;
    scrollingTo.current = Date.now();
    setActiveSection(id);
    const y = el.getBoundingClientRect().top + window.scrollY - SECTION_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
  };

  // Bosh sahifadan kategoriya bilan kelinsa — o'sha bo'limga
  useEffect(() => {
    if (menuMode && category && category !== 'all') requestAnimationFrame(() => scrollToSection(category, false));
    else if (sections[0]) setActiveSection(sections[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aylantirilganda faol bo'limni kuzatish
  useEffect(() => {
    if (!menuMode) return;
    const els = sections.map((s) => document.getElementById(`sec-${s.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() - scrollingTo.current < 700) return; // yorliq bosilgandan keyingi silliq aylantirish
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id.slice(4));
      },
      { rootMargin: `-${SECTION_OFFSET + 10}px 0px -55% 0px` }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [menuMode, sections]);

  // Faol yorliqni ko'rinadigan joyga suramiz
  useEffect(() => {
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-sec="${activeSection}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeSection]);

  return (
    <div className="screen screen--catalog">
      <div className="screen__head">
        <h1 className="screen__title">{t('catalog_title')}</h1>
        <p className="muted">{t('catalog_sub')}</p>
      </div>

      <SearchBar value={query} onChange={setQuery} onFilter={() => setSortOpen(true)} autoFocus={props.autoFocusSearch} filterActive={sort !== 'popular'} />

      {/* Yopishqoq yorliqlar */}
      <div className="chips" ref={chipsRef} role="tablist">
        {menuMode
          ? sections.map((s) => (
              <button
                key={s.id}
                data-sec={s.id}
                role="tab"
                aria-selected={activeSection === s.id}
                className={cn('chip-tag', activeSection === s.id && 'is-active')}
                onClick={() => {
                  haptic.select();
                  scrollToSection(s.id);
                }}
              >
                <span>{s.emoji}</span> {s.title}
              </button>
            ))
          : catalog.categories.map((c) => (
              <button
                key={c.id}
                data-sec={c.id}
                role="tab"
                aria-selected={category === c.id}
                className={cn('chip-tag', category === c.id && 'is-active')}
                onClick={() => {
                  haptic.select();
                  onCategoryChange(c.id);
                }}
              >
                <span>{c.emoji}</span> {c.title}
              </button>
            ))}
      </div>

      {menuMode ? (
        sections.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="menu-section">
            <div className="menu-section__head">
              <h2 className="menu-section__title">
                <span>{s.emoji}</span> {s.title}
              </h2>
              <span className="menu-section__count">{s.products.length}</span>
            </div>
            <div className="grid">
              {s.products.map((p) => (
                <ProductCard key={p.id} product={p} qty={qtyOf(p.id)} onOpen={() => onOpen(p)} onAdd={() => onAdd(p)} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <>
          <div className="grid">
            {flat.map((p) => (
              <ProductCard key={p.id} product={p} qty={qtyOf(p.id)} onOpen={() => onOpen(p)} onAdd={() => onAdd(p)} />
            ))}
          </div>
          {flat.length === 0 && <div className="empty-mini">{query ? t('not_found', { q: query }) : t('empty_cat')}</div>}
        </>
      )}

      {cartCount > 0 && (
        <button className="cart-bar" onClick={onGoCart}>
          <span className="cart-bar__count">{cartCount}</span>
          <span>{t('go_cart')}</span>
          <b>{formatPrice(cartTotal)}</b>
          <Icon name="arrow" size={18} />
        </button>
      )}

      <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)} title={t('sort')}>
        <div className="sort-list">
          {SORTS.map((s) => (
            <button
              key={s.id}
              className={cn('sort-item', sort === s.id && 'is-active')}
              onClick={() => {
                haptic.select();
                setSort(s.id);
                setSortOpen(false);
              }}
            >
              {t(s.title)}
              <span className="pay__radio" />
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
