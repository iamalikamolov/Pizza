'use client';

// Admin panel: statistika, buyurtmalar va menyu (faqat adminlarga ko'rinadi)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Input, Textarea } from '@/components/ui/Input';
import Switch from '@/components/ui/Switch';
import { bindBackButton, useTelegram } from '@/hooks/useTelegram';
import { getPosition } from '@/components/features/AddressBook';
import {
  api,
  type AdminOrder,
  type AdminProduct,
  type AdminStats,
  type Banner,
  type BannerTheme,
  type Category,
  type Me,
  type OrderStatus,
  type Perm,
  type ProductInput,
  type Role,
  type StaffMember,
  type AppSettings,
  type AdminBranch,
  type AdminCategory,
  type AdminStory,
  type StoryInput,
  type I18nMap,
} from '@/lib/api';
import { cn, formatDate, formatPhoneInput, formatPrice, thumb, resizeToDataUrl } from '@/lib/utils';

type Section = 'orders' | 'stats' | 'menu' | 'ads' | 'stories' | 'branches' | 'staff' | 'settings';

const ALL_FILTERS: Array<{ id: OrderStatus | 'all'; title: string }> = [
  { id: 'new', title: '🆕 Yangi' },
  { id: 'accepted', title: '👨‍🍳 Tayyorlanmoqda' },
  { id: 'ready', title: '📦 Tayyor' },
  { id: 'delivering', title: '🛵 Yoʻlda' },
  { id: 'done', title: '✅ Yetkazildi' },
  { id: 'cancelled', title: '❌ Bekor' },
  { id: 'all', title: 'Hammasi' },
];
const STATUS_FILTERS = ALL_FILTERS;

// Rolga qarab ko'rinadigan filtrlar
const ROLE_FILTERS: Partial<Record<Role, Array<OrderStatus | 'all'>>> = {
  cook: ['new', 'accepted', 'ready'],
  courier: ['ready', 'delivering', 'done'],
};

const ACTION_LABEL: Record<OrderStatus, string> = {
  new: 'Yangi',
  accepted: '👨‍🍳 Qabul qilish',
  ready: '📦 Tayyor',
  delivering: '🛵 Olib ketdim',
  done: '✅ Yetkazildi',
  cancelled: 'Bekor',
};

const SECTIONS: Array<{ id: Section; icon: string; title: string; perm: Perm }> = [
  { id: 'orders', icon: '📦', title: 'Buyurtmalar', perm: 'orders' },
  { id: 'stats', icon: '📊', title: 'Statistika', perm: 'stats' },
  { id: 'menu', icon: '🍕', title: 'Menyu', perm: 'menu' },
  { id: 'ads', icon: '📣', title: 'Reklama', perm: 'ads' },
  { id: 'stories', icon: '📖', title: 'Storislar', perm: 'ads' },
  { id: 'branches', icon: '🏪', title: 'Filiallar', perm: 'branches' },
  { id: 'staff', icon: '👥', title: 'Xodimlar', perm: 'staff' },
  { id: 'settings', icon: '⚙️', title: 'Sozlamalar', perm: 'settings' },
];

type Props = { me: Me; onClose: () => void };

export default function AdminPanel({ me, onClose }: Props) {
  const { webApp } = useTelegram();
  const sections = SECTIONS.filter((s) => me.perms.includes(s.perm));
  const [section, setSection] = useState<Section>(sections[0]?.id || 'orders');

  useEffect(() => bindBackButton(webApp, onClose), [webApp, onClose]);
  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);

  const title = me.role === 'owner' ? 'Admin panel' : me.roleTitle;

  return createPortal(
    <div className="admin">
      <header className="admin__top">
        <button className="icon-btn glass" onClick={onClose} aria-label="Orqaga">
          <Icon name="arrow" style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div className="admin__title">{title}</div>
        <span style={{ width: 44 }} />
      </header>

      {sections.length > 1 && (
        <div className={cn('admin__tabs glass', sections.length > 4 && 'admin__tabs--scroll')} role="tablist">
          {sections.map((s) => (
            <button key={s.id} role="tab" aria-selected={section === s.id} className={cn('admin__tab', section === s.id && 'is-active')} onClick={() => setSection(s.id)}>
              <span>{s.icon}</span>
              {s.title}
            </button>
          ))}
        </div>
      )}

      <div className="admin__body">
        {section === 'orders' && <OrdersSection role={me.role} ownBranch={me.branchId} />}
        {section === 'stats' && <StatsSection />}
        {section === 'menu' && <MenuSection />}
        {section === 'ads' && <AdsSection />}
        {section === 'stories' && <StoriesSection />}
        {section === 'branches' && <BranchesSection />}
        {section === 'staff' && <StaffSection />}
        {section === 'settings' && <SettingsSection />}
      </div>
    </div>,
    document.body
  );
}

/* ================= Buyurtmalar ================= */

function OrdersSection({ role, ownBranch }: { role: Role; ownBranch: number | null }) {
  const { haptic, webApp } = useTelegram();
  const allowed = ROLE_FILTERS[role];
  const filters = allowed ? ALL_FILTERS.filter((f) => allowed.includes(f.id)) : ALL_FILTERS;
  const [filter, setFilter] = useState<OrderStatus | 'all'>(role === 'courier' ? 'ready' : 'new');
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [branchFilter, setBranchFilter] = useState<number | null>(null);
  const canFilterBranch = (role === 'owner' || role === 'manager') && !ownBranch;

  useEffect(() => {
    api.admin
      .branches()
      .then((r) => setBranches(r.branches))
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    setError('');
    api.admin
      .orders(filter, branchFilter)
      .then(setOrders)
      .catch((e: Error) => setError(e.message));
  }, [filter, branchFilter]);

  useEffect(() => {
    setOrders(null);
    load();
    const t = setInterval(load, 15000); // har 15 soniyada yangilanadi
    return () => clearInterval(t);
  }, [load]);

  const changeStatus = async (order: AdminOrder, status: OrderStatus) => {
    if (status === 'cancelled') {
      const ok = await new Promise<boolean>((resolve) =>
        webApp ? webApp.showConfirm(`#${order.id} buyurtmani bekor qilasizmi?`, resolve) : resolve(window.confirm('Bekor qilasizmi?'))
      );
      if (!ok) return;
    }
    setBusyId(order.id);
    try {
      await api.admin.setStatus(order.id, status);
      haptic.notify('success');
      load();
    } catch (e) {
      haptic.notify('error');
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {canFilterBranch && branches.length > 1 && (
        <div className="chips admin__chips">
          <button className={cn('chip-tag', branchFilter === null && 'is-active')} onClick={() => setBranchFilter(null)}>
            🏪 Barcha filiallar
          </button>
          {branches.map((b) => (
            <button key={b.id} className={cn('chip-tag', branchFilter === b.id && 'is-active')} onClick={() => setBranchFilter(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}
      <div className="chips admin__chips">
        {filters.map((f) => (
          <button key={f.id} className={cn('chip-tag', filter === f.id && 'is-active')} onClick={() => setFilter(f.id)}>
            {f.title}
          </button>
        ))}
      </div>

      <div className="admin__toolbar">
        <span className="muted">{orders ? `${orders.length} ta buyurtma` : 'Yuklanmoqda…'}</span>
        <button className="link-btn" onClick={load}>
          ↻ Yangilash
        </button>
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}
      {!orders && !error && <div className="skeleton skeleton--row" />}
      {orders && orders.length === 0 && <div className="empty-mini">Bu boʻlimda buyurtmalar yoʻq</div>}

      <ul className="admin-orders">
        {orders?.map((o) => {
          const open = openId === o.id || role === 'courier';
          const actions = o.nextStatuses.filter((a) => a.status !== 'cancelled');
          const canCancel = o.nextStatuses.some((a) => a.status === 'cancelled');
          return (
            <li key={o.id} className={cn('admin-order', `admin-order--${o.status}`)}>
              <button className="admin-order__head" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                <div>
                  <div className="admin-order__id">
                    #{o.id} <span className="admin-order__status">{o.statusTitle}</span>
                  </div>
                  <div className="admin-order__who">
                    {o.customerName} · {formatDate(o.createdAt)}
                  </div>
                  <div className="admin-order__tags">
                    <span className={cn('order-tag', o.orderType === 'dinein' && 'order-tag--dine')}>
                      {o.orderType === 'dinein' ? `🍽 ${o.tableNo}-stol` : '🛵 Yetkazish'}
                    </span>
                    {o.branchName && <span className="order-tag">🏪 {o.branchName}</span>}
                  </div>
                </div>
                <div className="admin-order__total">{formatPrice(o.total)}</div>
              </button>

              <div className="admin-order__items">
                {o.items.map((i) => `${i.reward ? '🎁 ' : ''}${i.name} × ${i.qty}`).join(', ')}
                {o.bumpAdded ? ` + ${o.bumpTitle}` : ''}
              </div>

              {open && (
                <div className="admin-order__details">
                  <div>
                    📞{' '}
                    <a href={`tel:${o.phone}`} className="link-btn">
                      {formatPhoneInput(o.phone)}
                    </a>
                    {o.username && (
                      <>
                        {' · '}
                        <button className="link-btn" onClick={() => webApp?.openTelegramLink(`https://t.me/${o.username}`)}>
                          @{o.username}
                        </button>
                      </>
                    )}
                  </div>
                  <div>📍 {o.address}</div>
                  {o.mapUrl && (
                    <button className="link-btn" onClick={() => (webApp ? webApp.openLink(o.mapUrl) : window.open(o.mapUrl, '_blank'))}>
                      🗺 Xaritada ochish
                    </button>
                  )}
                  {o.comment && <div>💬 {o.comment}</div>}
                  <div>
                    💳 {o.paymentTitle} — {o.paymentStatusTitle}
                  </div>
                  {o.coinsSpent > 0 && <div>🪙 Coin bilan: {o.coinsSpent} coin</div>}
                  <div className="muted">
                    Mahsulotlar {formatPrice(o.subtotal)} · Yetkazish {o.deliveryFee ? formatPrice(o.deliveryFee) : 'bepul'}
                  </div>
                </div>
              )}

              {(actions.length > 0 || canCancel) && (
                <div className="admin-order__actions">
                  {actions.map((a) => (
                    <Button key={a.status} loading={busyId === o.id} disabled={busyId === o.id} onClick={() => changeStatus(o, a.status)}>
                      {ACTION_LABEL[a.status]}
                    </Button>
                  ))}
                  {canCancel && (
                    <Button variant="secondary" className="btn--danger" disabled={busyId === o.id} onClick={() => changeStatus(o, 'cancelled')}>
                      Bekor
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ================= Statistika ================= */

function StatsSection() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.admin
      .stats()
      .then(setStats)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="form-error">⚠️ {error}</div>;
  if (!stats) return <div className="skeleton skeleton--hero" />;

  const max = Math.max(1, ...stats.daily.map((d) => d.revenue));

  return (
    <>
      <div className="admin-kpis">
        <div className="admin-kpi admin-kpi--dark">
          <span>Bugungi daromad</span>
          <b>{formatPrice(stats.today.revenue)}</b>
          <small>{stats.today.orders} ta buyurtma</small>
        </div>
        <div className="admin-kpi">
          <span>7 kunlik daromad</span>
          <b>{formatPrice(stats.week.revenue)}</b>
          <small>{stats.week.orders} ta buyurtma</small>
        </div>
        <div className="admin-kpi">
          <span>Oʻrtacha chek</span>
          <b>{formatPrice(stats.week.avgCheck)}</b>
          <small>soʻnggi 7 kun</small>
        </div>
        <div className="admin-kpi">
          <span>Jami mijozlar</span>
          <b>{stats.totals.customers}</b>
          <small>{stats.totals.orders} ta buyurtma</small>
        </div>
      </div>

      <h3 className="section-title">Soʻnggi 7 kun</h3>
      <div className="admin-chart">
        {stats.daily.map((d) => (
          <div key={d.day} className="admin-chart__col" title={`${d.day}: ${formatPrice(d.revenue)}`}>
            <span className="admin-chart__val">{d.revenue ? `${Math.round(d.revenue / 1000)}k` : ''}</span>
            <div className="admin-chart__bar" style={{ height: `${Math.max(4, (d.revenue / max) * 100)}%` }} />
            <span className="admin-chart__day">{d.day}</span>
          </div>
        ))}
      </div>

      <h3 className="section-title">Holatlar boʻyicha</h3>
      <div className="admin-statuses">
        {STATUS_FILTERS.filter((s) => s.id !== 'all').map((s) => (
          <div key={s.id} className="admin-status">
            <span>{s.title}</span>
            <b>{stats.statuses[s.id as OrderStatus] || 0}</b>
          </div>
        ))}
      </div>

      <h3 className="section-title">Eng koʻp sotilgan</h3>
      {stats.top.length === 0 && <div className="empty-mini">Hali sotuvlar yoʻq</div>}
      <ol className="admin-top">
        {stats.top.map((t) => (
          <li key={t.name}>
            <span>{t.name}</span>
            <span className="muted">{t.qty} ta</span>
            <b>{formatPrice(t.revenue)}</b>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ================= Menyu ================= */

const EMPTY: ProductInput = {
  name: '',
  description: '',
  price: 0,
  oldPrice: 0,
  badge: '',
  image: '',
  categories: [],
  ingredients: [],
  size: '30 sm',
  weight: '',
};

function MenuSection() {
  const { haptic } = useTelegram();
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; data: ProductInput } | null>(null);

  const load = useCallback(() => {
    api.admin
      .products()
      .then((r) => {
        setProducts(r.products);
        setCategories(r.categories);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const images = useMemo(() => Array.from(new Set((products || []).map((p) => p.image))), [products]);

  const toggleActive = async (p: AdminProduct, value: boolean) => {
    setProducts((list) => list?.map((x) => (x.id === p.id ? { ...x, isActive: value } : x)) || null);
    try {
      await api.admin.updateProduct(p.id, { isActive: value });
      haptic.select();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  return (
    <>
      <CategoriesManager onChanged={load} />

      <h3 className="section-title">🍕 Mahsulotlar</h3>
      <div className="admin__toolbar">
        <span className="muted">{products ? `${products.length} ta mahsulot` : 'Yuklanmoqda…'}</span>
        <Button onClick={() => setEditing({ id: null, data: { ...EMPTY, image: images[0] || '' } })}>+ Yangi pitsa</Button>
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}
      {!products && !error && <div className="skeleton skeleton--row" />}

      <ul className="admin-menu">
        {products?.map((p) => (
          <li key={p.id} className={cn('admin-product', !p.isActive && 'is-off')}>
            <img src={thumb(p.image)} alt="" />
            <button className="admin-product__info" onClick={() => setEditing({ id: p.id, data: { ...p } })}>
              <b>{p.name}</b>
              <span>
                <span className="price__new">{formatPrice(p.price)}</span>
                {p.oldPrice > p.price && <span className="price__old"> {formatPrice(p.oldPrice, false)}</span>}
              </span>
              <small>{p.isActive ? 'Menyuda koʻrinadi' : 'Yashirilgan'} · ✏️ tahrirlash</small>
            </button>
            <Switch checked={p.isActive} onChange={(v) => toggleActive(p, v)} label="Menyuda koʻrsatish" />
          </li>
        ))}
      </ul>

      <ProductEditor
        state={editing}
        categories={categories}
        images={images}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          haptic.notify('success');
          load();
        }}
      />
    </>
  );
}

type EditorProps = {
  state: { id: string | null; data: ProductInput } | null;
  categories: Category[];
  images: string[];
  onClose: () => void;
  onSaved: () => void;
};

function ProductEditor({ state, categories, images, onClose, onSaved }: EditorProps) {
  const [form, setForm] = useState<ProductInput>(EMPTY);
  const [ingredientsText, setIngredientsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state) return;
    setForm(state.data);
    setIngredientsText((state.data.ingredients || []).join('\n'));
    setError('');
  }, [state]);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;

  const save = async () => {
    setSaving(true);
    setError('');
    const payload: ProductInput = {
      name: form.name,
      description: form.description,
      price: form.price,
      oldPrice: form.oldPrice,
      badge: form.badge,
      image: form.image,
      categories: form.categories,
      size: form.size,
      weight: form.weight,
      coinPrice: form.coinPrice || null,
      i18n: form.i18n,
      ingredients: ingredientsText.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (state?.id) await api.admin.updateProduct(state.id, payload);
      else await api.admin.createProduct(payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={Boolean(state)}
      onClose={onClose}
      title={state?.id ? 'Tahrirlash' : 'Yangi pitsa'}
      footer={
        <div className="sticky-cta sticky-cta--column">
          {error && <div className="form-error">⚠️ {error}</div>}
          <Button size="lg" block loading={saving} onClick={save}>
            Saqlash
          </Button>
        </div>
      }
    >
      {form.image && <img className="admin-editor__preview" src={form.image} alt="" />}

      <Input label="Nomi" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
      <Textarea label="Qisqa tavsif" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />

      <div className="admin-editor__row">
        <Input
          label="Yangi narx (soʻm)"
          inputMode="numeric"
          value={form.price ? formatPrice(form.price, false) : ''}
          onChange={(e) => set('price', num(e.target.value))}
        />
        <Input
          label="Eski narx (chizilgan)"
          inputMode="numeric"
          value={form.oldPrice ? formatPrice(form.oldPrice, false) : ''}
          onChange={(e) => set('oldPrice', num(e.target.value))}
        />
      </div>

      <div className="admin-editor__row">
        <Input label="Oʻlcham" value={form.size || ''} onChange={(e) => set('size', e.target.value)} />
        <Input label="Ogʻirlik" value={form.weight || ''} onChange={(e) => set('weight', e.target.value)} />
      </div>

      <Input label="Belgi (Hit, Premium, Yangi…)" value={form.badge || ''} onChange={(e) => set('badge', e.target.value)} />

      <Input
        label="🪙 Coinga olish narxi (boʻsh — coinga sotilmaydi)"
        inputMode="numeric"
        placeholder="Masalan: 600"
        value={form.coinPrice ? String(form.coinPrice) : ''}
        onChange={(e) => set('coinPrice', num(e.target.value) || null)}
      />

      <div className="field">
        <span className="field__label">Kategoriyalar</span>
        <div className="admin-editor__cats">
          {categories.map((c) => {
            const on = form.categories?.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={cn('chip-tag', on && 'is-active')}
                onClick={() =>
                  set('categories', on ? form.categories!.filter((x) => x !== c.id) : [...(form.categories || []), c.id])
                }
              >
                {c.emoji} {c.title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Rasm</span>
        <div className="admin-editor__images">
          {images.map((src) => (
            <button key={src} type="button" className={cn('admin-editor__img', form.image === src && 'is-active')} onClick={() => set('image', src)}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      </div>
      <Input
        label="yoki rasm havolasi (https://…)"
        placeholder="https://…"
        value={form.image?.startsWith('https://') ? form.image : ''}
        onChange={(e) => set('image', e.target.value.trim())}
      />

      <Textarea
        label="Tarkibi (har qatorda bittadan)"
        rows={4}
        value={ingredientsText}
        onChange={(e) => setIngredientsText(e.target.value)}
      />

      <I18nFields
        value={form.i18n || {}}
        onChange={(v) => set('i18n', v)}
        fields={[
          { key: 'name', label: 'Nomi' },
          { key: 'description', label: 'Tavsif', area: true },
          { key: 'ingredients', label: 'Tarkibi (har qatorda bittadan)', list: true },
        ]}
      />
    </BottomSheet>
  );
}

/* ================= Reklama (bannerlar) ================= */

const THEMES: Array<{ id: BannerTheme; title: string }> = [
  { id: 'red', title: 'Qizil' },
  { id: 'dark', title: 'Toʻq' },
  { id: 'gold', title: 'Oltin' },
  { id: 'green', title: 'Yashil' },
];

const EMPTY_BANNER: Partial<Banner> = {
  placement: 'hero',
  kicker: '',
  title: '',
  subtitle: '',
  image: '/images/hero.jpg',
  ctaLabel: 'Buyurtma berish',
  action: 'catalog',
  theme: 'red',
};

function actionTitle(action: string, products: AdminProduct[], categories: Category[]): string {
  if (action === 'catalog') return 'Katalog';
  if (action.startsWith('category:')) return `Kategoriya: ${categories.find((c) => `category:${c.id}` === action)?.title || action.slice(9)}`;
  if (action.startsWith('product:')) return `Pitsa: ${products.find((p) => `product:${p.id}` === action)?.name || action.slice(8)}`;
  if (action.startsWith('url:')) return 'Havola';
  if (action === 'cart') return 'Savatcha';
  if (action === 'bonus') return 'Bonuslar';
  if (action === 'details') return 'Batafsil sahifa';
  return action;
}

function AdsSection() {
  const { haptic } = useTelegram();
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id: number | null; data: Partial<Banner> } | null>(null);

  const load = useCallback(() => {
    Promise.all([api.admin.banners(), api.admin.products()])
      .then(([b, p]) => {
        setBanners(b);
        setProducts(p.products);
        setCategories(p.categories);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const toggle = async (b: Banner, value: boolean) => {
    setBanners((list) => list?.map((x) => (x.id === b.id ? { ...x, isActive: value } : x)) || null);
    try {
      await api.admin.updateBanner(b.id, { isActive: value });
      haptic.select();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  const groups: Array<{ id: Banner['placement']; title: string; hint: string }> = [
    { id: 'hero', title: 'Bosh sahifa karuseli', hint: 'Tepada aylanib turadigan katta bannerlar' },
    { id: 'bottom', title: 'Pastki banner', hint: 'Ommabop pitsalardan keyin — birinchi faoli koʻrinadi' },
  ];

  return (
    <>
      <div className="admin__toolbar">
        <span className="muted">{banners ? `${banners.length} ta banner` : 'Yuklanmoqda…'}</span>
        <Button onClick={() => setEditing({ id: null, data: { ...EMPTY_BANNER } })}>+ Yangi banner</Button>
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}
      {!banners && !error && <div className="skeleton skeleton--row" />}

      {banners &&
        groups.map((g) => (
          <div key={g.id}>
            <h3 className="section-title">{g.title}</h3>
            <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>
              {g.hint}
            </p>
            <ul className="admin-banners">
              {banners
                .filter((b) => b.placement === g.id)
                .map((b) => (
                  <li key={b.id} className={cn('admin-banner', !b.isActive && 'is-off')}>
                    <span className={cn('admin-banner__thumb', `theme-${b.theme}`)}>
                      <img src={thumb(b.image)} alt="" />
                    </span>
                    <button className="admin-product__info" onClick={() => setEditing({ id: b.id, data: { ...b } })}>
                      <span className="admin-banner__place">{b.kicker || 'Banner'}</span>
                      <b>{b.title}</b>
                      <small>
                        {b.isActive ? 'Koʻrinadi' : 'Yashirilgan'} · {actionTitle(b.action, products, categories)} · ✏️
                      </small>
                    </button>
                    <Switch checked={b.isActive} onChange={(v) => toggle(b, v)} label="Bannerni koʻrsatish" />
                  </li>
                ))}
              {banners.filter((b) => b.placement === g.id).length === 0 && <div className="empty-mini">Bu joyda banner yoʻq</div>}
            </ul>
          </div>
        ))}

      <BannerEditor
        state={editing}
        products={products}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          haptic.notify('success');
          load();
        }}
      />
    </>
  );
}

type BannerEditorProps = {
  state: { id: number | null; data: Partial<Banner> } | null;
  products: AdminProduct[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
};

function BannerEditor({ state, products, categories, onClose, onSaved }: BannerEditorProps) {
  const [form, setForm] = useState<Partial<Banner>>(EMPTY_BANNER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state) return;
    setForm(state.data);
    setError('');
  }, [state]);

  const set = <K extends keyof Banner>(key: K, value: Banner[K]) => setForm((f) => ({ ...f, [key]: value }));
  const images = useMemo(
    () => Array.from(new Set(['/images/hero.jpg', '/images/promo.jpg', '/images/onboarding.jpg', ...products.map((p) => p.image)])),
    [products]
  );

  const action = form.action || 'catalog';
  const actionType = action.startsWith('category:')
    ? 'category'
    : action.startsWith('product:')
      ? 'product'
      : action.startsWith('url:')
        ? 'url'
        : ['cart', 'bonus', 'details'].includes(action)
          ? action
          : 'catalog';

  const save = async () => {
    setSaving(true);
    setError('');
    const payload: Partial<Banner> = {
      placement: form.placement,
      kicker: form.kicker,
      title: form.title,
      subtitle: form.subtitle,
      image: form.image,
      ctaLabel: form.ctaLabel,
      action: form.action,
      theme: form.theme,
      details: form.details,
      i18n: form.i18n,
    };
    try {
      if (state?.id) await api.admin.updateBanner(state.id, payload);
      else await api.admin.createBanner(payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={Boolean(state)}
      onClose={onClose}
      title={state?.id ? 'Bannerni tahrirlash' : 'Yangi banner'}
      footer={
        <div className="sticky-cta sticky-cta--column">
          {error && <div className="form-error">⚠️ {error}</div>}
          <Button size="lg" block loading={saving} onClick={save}>
            Saqlash
          </Button>
        </div>
      }
    >
      {/* Jonli ko'rinish */}
      <div className="admin-banner-preview">
        <div className="hero">
          <div className="hero__track">
            <article className={cn('hero__slide', `theme-${form.theme || 'red'}`)}>
              {form.image && <img className="hero__img" src={form.image} alt="" />}
              <div className="hero__shade" />
              <div className="hero__glare" />
              <div className="hero__content">
                {form.kicker && <span className="hero__kicker">{form.kicker}</span>}
                <h2 className="hero__title">{form.title || 'Sarlavha'}</h2>
                {form.subtitle && <p className="hero__text">{form.subtitle}</p>}
                <span className="glass-pill">{form.ctaLabel || 'Tugma'} →</span>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div className="field">
        <span className="field__label">Joylashuv</span>
        <div className="admin-editor__cats">
          {(
            [
              ['hero', 'Tepadagi karusel'],
              ['bottom', 'Pastki banner'],
            ] as Array<[Banner['placement'], string]>
          ).map(([id, title]) => (
            <button key={id} type="button" className={cn('chip-tag', form.placement === id && 'is-active')} onClick={() => set('placement', id)}>
              {title}
            </button>
          ))}
        </div>
      </div>

      <Input label="Kichik yozuv (masalan: Yangilik)" value={form.kicker || ''} onChange={(e) => set('kicker', e.target.value)} />
      <Input label="Sarlavha" value={form.title || ''} onChange={(e) => set('title', e.target.value)} />
      <Textarea label="Qisqa matn" value={form.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} />
      <Input label="Tugma matni" value={form.ctaLabel || ''} onChange={(e) => set('ctaLabel', e.target.value)} />

      <div className="field">
        <span className="field__label">Reklama yoki tugma bosilganda nima ochilsin</span>
        <div className="admin-editor__cats">
          {(
            [
              ['catalog', 'Katalog'],
              ['category', 'Kategoriya'],
              ['product', 'Pitsa'],
              ['details', 'Batafsil sahifa'],
              ['cart', 'Savatcha'],
              ['bonus', 'Bonuslar'],
              ['url', 'Havola'],
            ] as Array<[string, string]>
          ).map(([id, title]) => (
            <button
              key={id}
              type="button"
              className={cn('chip-tag', actionType === id && 'is-active')}
              onClick={() =>
                set(
                  'action',
                  id === 'catalog' || id === 'cart' || id === 'bonus' || id === 'details'
                    ? id
                    : id === 'category'
                      ? `category:${categories[0]?.id || 'hit'}`
                      : id === 'product'
                        ? `product:${products[0]?.id || ''}`
                        : 'url:https://'
                )
              }
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      {actionType === 'category' && (
        <div className="admin-editor__cats" style={{ marginTop: 8 }}>
          {categories.map((c) => (
            <button key={c.id} type="button" className={cn('chip-tag', action === `category:${c.id}` && 'is-active')} onClick={() => set('action', `category:${c.id}`)}>
              {c.emoji} {c.title}
            </button>
          ))}
        </div>
      )}
      {actionType === 'product' && (
        <div className="admin-editor__images" style={{ marginTop: 8 }}>
          {products.map((p) => (
            <button key={p.id} type="button" className={cn('admin-editor__img', action === `product:${p.id}` && 'is-active')} onClick={() => set('action', `product:${p.id}`)} title={p.name}>
              <img src={thumb(p.image)} alt={p.name} />
            </button>
          ))}
        </div>
      )}
      {actionType === 'details' && (
        <Textarea
          label="Batafsil matn (reklama bosilganda ochiladi)"
          rows={6}
          placeholder={'Aksiya shartlari, muddati va h.k.\nHar bir yangi qator alohida xatboshi boʻladi.'}
          value={form.details || ''}
          onChange={(e) => set('details', e.target.value)}
        />
      )}
      {actionType === 'url' && (
        <Input label="Havola (https://…)" value={action.slice(4)} onChange={(e) => set('action', `url:${e.target.value.trim()}`)} />
      )}

      <div className="field">
        <span className="field__label">Rang</span>
        <div className="admin-editor__swatches">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.title}
              aria-label={t.title}
              className={cn('admin-editor__swatch', `theme-${t.id}`, form.theme === t.id && 'is-active')}
              onClick={() => set('theme', t.id)}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Rasm</span>
        <div className="admin-editor__images">
          {images.map((src) => (
            <button key={src} type="button" className={cn('admin-editor__img', form.image === src && 'is-active')} onClick={() => set('image', src)}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      </div>
      <Input
        label="yoki rasm havolasi (https://…)"
        placeholder="https://…"
        value={form.image?.startsWith('https://') ? form.image : ''}
        onChange={(e) => set('image', e.target.value.trim())}
      />

      <I18nFields
        value={form.i18n || {}}
        onChange={(v) => set('i18n', v)}
        fields={[
          { key: 'kicker', label: 'Kichik yozuv' },
          { key: 'title', label: 'Sarlavha' },
          { key: 'subtitle', label: 'Qisqa matn', area: true },
          { key: 'ctaLabel', label: 'Tugma matni' },
          ...(actionType === 'details' ? [{ key: 'details', label: 'Batafsil matn', area: true }] : []),
        ]}
      />
    </BottomSheet>
  );
}

/* ================= Xodimlar ================= */

function StaffSection() {
  const { webApp, haptic } = useTelegram();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [roles, setRoles] = useState<Array<{ id: Role; title: string; perms: Perm[] }>>([]);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{ link: string; roleTitle: string; branchName: string } | null>(null);
  const [inviteBranch, setInviteBranch] = useState<number | null>(null); // null — barcha filiallar
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [branches, setBranches] = useState<AdminBranch[]>([]);

  useEffect(() => {
    api.admin
      .branches()
      .then((r) => {
        setBranches(r.branches);
        if (r.branches.length === 1) setInviteBranch(r.branches[0].id);
      })
      .catch(() => undefined);
  }, []);

  const changeBranch = async (m: StaffMember, branchId: number | null) => {
    try {
      await api.admin.setStaffBranch(m.telegramId, branchId);
      setEditing({ ...m, branchId });
      haptic.select();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const load = useCallback(() => {
    api.admin
      .staff()
      .then((r) => {
        setStaff(r.staff);
        setRoles(r.roles);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const PERM_TEXT: Record<Perm, string> = {
    orders: 'buyurtmalar',
    stats: 'statistika',
    menu: 'menyu',
    ads: 'reklama',
    staff: 'xodimlar',
    settings: 'sozlamalar',
    branches: 'filiallar',
  };

  const createInvite = async (role: Role) => {
    setBusy(role);
    setError('');
    try {
      const r = await api.admin.invite(role, inviteBranch);
      setInvite(r);
      haptic.notify('success');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const share = () => {
    if (!invite) return;
    const text = `Ayde Pizza (${invite.branchName}) jamoasiga ${invite.roleTitle} sifatida qoʻshiling 👇`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(invite.link)}&text=${encodeURIComponent(text)}`;
    if (webApp) webApp.openTelegramLink(url);
    else window.open(url, '_blank');
  };

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      haptic.notify('success');
    } catch {
      setError('Nusxalab boʻlmadi — havolani qoʻlda belgilang');
    }
  };

  const changeRole = async (m: StaffMember, role: Role) => {
    if (role === 'customer') {
      const ok = await new Promise<boolean>((resolve) =>
        webApp ? webApp.showConfirm(`${m.name} jamoadan chiqarilsinmi?`, resolve) : resolve(window.confirm('Chiqarilsinmi?'))
      );
      if (!ok) return;
    }
    try {
      await api.admin.setRole(m.telegramId, role);
      haptic.notify('success');
      setEditing(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <h3 className="section-title" style={{ marginTop: 4 }}>
        Xodim qoʻshish
      </h3>

      <div className="invite-step">
        <span className="invite-step__num">1</span>
        <b>Qaysi filialda ishlaydi?</b>
      </div>
      <div className="admin-editor__cats" style={{ marginBottom: 6 }}>
        {branches.map((b) => (
          <button
            key={b.id}
            className={cn('chip-tag', inviteBranch === b.id && 'is-active')}
            onClick={() => {
              setInviteBranch(b.id);
              setInvite(null);
            }}
          >
            🏪 {b.name}
          </button>
        ))}
        {branches.length > 1 && (
          <button
            className={cn('chip-tag', inviteBranch === null && 'is-active')}
            onClick={() => {
              setInviteBranch(null);
              setInvite(null);
            }}
          >
            🌐 Barcha filiallar
          </button>
        )}
      </div>
      {branches.length <= 1 && (
        <p className="muted" style={{ marginBottom: 6 }}>
          Hozir bitta filial bor. Yangi filial qoʻshish: yuqoridagi <b>🏪 Filiallar</b> boʻlimi → <b>+ Yangi filial</b>. Shundan
          keyin bu yerda tanlanadi.
        </p>
      )}

      <div className="invite-step">
        <span className="invite-step__num">2</span>
        <b>Lavozimini tanlang — taklif havolasi yaratiladi</b>
      </div>
      <div className="role-cards">
        {roles.map((r) => (
          <button key={r.id} className="role-card glass" onClick={() => createInvite(r.id)} disabled={Boolean(busy)}>
            <b>{r.title}</b>
            <small>{r.perms.map((p) => PERM_TEXT[p]).join(', ')}</small>
            <span className="role-card__cta">{busy === r.id ? '…' : '+ Taklif'}</span>
          </button>
        ))}
      </div>

      {invite && (
        <div className="invite-box glass">
          <b>
            3. Havolani xodimga yuboring — {invite.roleTitle}, 🏪 {invite.branchName}
          </b>
          <small className="muted">Xodim havolani ochib botga kirsa, shu filialga avtomatik qoʻshiladi. Havola bir martalik, 7 kun amal qiladi.</small>
          <code>{invite.link}</code>
          <div className="invite-box__actions">
            <Button onClick={share}>📤 Yuborish</Button>
            <Button variant="secondary" onClick={copy}>
              Nusxalash
            </Button>
          </div>
        </div>
      )}

      {error && <div className="form-error">⚠️ {error}</div>}

      <h3 className="section-title">Jamoa</h3>
      {!staff && !error && <div className="skeleton skeleton--row" />}
      <ul className="admin-menu">
        {staff?.map((m) => (
          <li key={m.telegramId} className="admin-product">
            <span className="staff-avatar">{m.name.charAt(0).toUpperCase()}</span>
            <button className="admin-product__info" onClick={() => m.editable && setEditing(m)}>
              <b>{m.name}</b>
              <span className="admin-banner__place">
                {m.roleTitle}
                {m.role !== 'owner' && (m.branchId ? ` · 🏪 ${branches.find((b) => b.id === m.branchId)?.name || ''}` : ' · barcha filiallar')}
              </span>
              <small>
                {m.username ? `@${m.username}` : `ID ${m.telegramId}`}
                {m.phone ? ` · ${formatPhoneInput(m.phone)}` : ''}
                {m.editable ? ' · ✏️' : ''}
              </small>
            </button>
          </li>
        ))}
      </ul>

      <BottomSheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.name || 'Xodim'}>
        {editing && (
          <div className="sort-list">
            {roles.map((r) => (
              <button key={r.id} className={cn('sort-item', editing.role === r.id && 'is-active')} onClick={() => changeRole(editing, r.id)}>
                {r.title}
                <span className="pay__radio" />
              </button>
            ))}
            {branches.length >= 1 && (
              <>
                <h3 className="section-title" style={{ margin: '12px 0 4px' }}>
                  🏪 Qaysi filialda ishlaydi
                </h3>
                <div className="admin-editor__cats">
                  <button className={cn('chip-tag', !editing.branchId && 'is-active')} onClick={() => changeBranch(editing, null)}>
                    Barcha filiallar
                  </button>
                  {branches.map((b) => (
                    <button key={b.id} className={cn('chip-tag', editing.branchId === b.id && 'is-active')} onClick={() => changeBranch(editing, b.id)}>
                      {b.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button className="sort-item sort-item--danger" style={{ marginTop: 12 }} onClick={() => changeRole(editing, 'customer')}>
              🚫 Jamoadan chiqarish
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

/* ================= Sozlamalar ================= */

function SettingsSection() {
  const { haptic } = useTelegram();
  const [s, setS] = useState<AppSettings | null>(null);
  const [rate, setRate] = useState('');
  const [interval, setIntervalSec] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    api.admin
      .settings()
      .then((r) => {
        setS(r);
        setRate(String(r.coinsPerThousand));
        setIntervalSec(String(r.bannerInterval));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const save = async (data: Partial<AppSettings>, label: string) => {
    setError('');
    try {
      const r = await api.admin.updateSettings(data);
      setS(r);
      haptic.notify('success');
      setSaved(label);
      setTimeout(() => setSaved(''), 1800);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!s) return error ? <div className="form-error">⚠️ {error}</div> : <div className="skeleton skeleton--row" />;

  const example = Math.floor(100 * (Number(rate) || 0));

  return (
    <>
      {error && <div className="form-error">⚠️ {error}</div>}

      <h3 className="section-title" style={{ marginTop: 4 }}>
        🪙 Coin (bonus) dasturi
      </h3>
      <div className="settings-card glass">
        <div className="settings-row">
          <div>
            <b>Coin yigʻish</b>
            <small>Mijozlar har yetkazilgan buyurtmadan coin oladi va ularni pitsaga almashtiradi</small>
          </div>
          <Switch checked={s.coinsEnabled} onChange={(v) => save({ coinsEnabled: v }, 'coins')} label="Coin dasturi" />
        </div>
        <div className="settings-row settings-row--input">
          <Input label="Har 1 000 soʻm uchun coin" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(',', '.'))} />
          <Button onClick={() => save({ coinsPerThousand: Number(rate) }, 'rate')}>{saved === 'rate' ? '✓' : 'Saqlash'}</Button>
        </div>
        <p className="muted">
          Misol: 100 000 soʻmlik buyurtma → <b>{example} coin</b>. Qaysi pitsa necha coinga olinishini “Menyu” boʻlimida har bir
          pitsa uchun belgilaysiz.
        </p>
      </div>

      <h3 className="section-title">📣 Reklama karuseli</h3>
      <div className="settings-card glass">
        <div className="settings-row settings-row--input">
          <Input label="Har bir reklama necha soniya turadi" inputMode="numeric" value={interval} onChange={(e) => setIntervalSec(e.target.value.replace(/\D/g, ''))} />
          <Button onClick={() => save({ bannerInterval: Number(interval) }, 'interval')}>{saved === 'interval' ? '✓' : 'Saqlash'}</Button>
        </div>
        <p className="muted">2 dan 60 soniyagacha. Reklamalar uzluksiz aylanadi (loop).</p>
      </div>
    </>
  );
}

/* ================= Tarjima maydonlari (RU / EN) ================= */

type I18nField = { key: string; label: string; area?: boolean; list?: boolean };

function I18nFields({ value, onChange, fields }: { value: I18nMap; onChange: (v: I18nMap) => void; fields: I18nField[] }) {
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const cur = (value[lang] || {}) as Record<string, string | string[]>;
  const setField = (key: string, v: string, list?: boolean) => {
    const next = { ...cur, [key]: list ? v.split('\n') : v };
    onChange({ ...value, [lang]: next });
  };
  return (
    <div className="i18n-box glass">
      <div className="i18n-box__head">
        <b>🌐 Tarjimalar</b>
        <div className="segmented segmented--sm">
          <button className={cn(lang === 'ru' && 'is-active')} onClick={() => setLang('ru')}>
            🇷🇺 RU
          </button>
          <button className={cn(lang === 'en' && 'is-active')} onClick={() => setLang('en')}>
            🇬🇧 EN
          </button>
        </div>
      </div>
      <p className="muted">Boʻsh qoldirilsa, oʻzbekcha matn koʻrsatiladi.</p>
      {fields.map((f) => {
        const raw = cur[f.key];
        const val = Array.isArray(raw) ? raw.join('\n') : raw || '';
        return f.area || f.list ? (
          <Textarea key={lang + f.key} label={`${f.label} (${lang.toUpperCase()})`} rows={f.list ? 4 : 2} value={val} onChange={(e) => setField(f.key, e.target.value, f.list)} />
        ) : (
          <Input key={lang + f.key} label={`${f.label} (${lang.toUpperCase()})`} value={val} onChange={(e) => setField(f.key, e.target.value)} />
        );
      })}
    </div>
  );
}

/* ================= Filiallar ================= */

const EMPTY_BRANCH = {
  name: '',
  nameRu: '',
  nameEn: '',
  address: '',
  coords: '',
  phone: '',
  openTime: '10:00',
  closeTime: '23:00',
  radiusKm: '10',
  tables: '10',
  chatId: '',
};

function BranchesSection() {
  const { haptic, webApp } = useTelegram();
  const [branches, setBranches] = useState<AdminBranch[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AdminBranch | 'new' | null>(null);
  const [qrBranch, setQrBranch] = useState<AdminBranch | null>(null);
  const [tablesBusy, setTablesBusy] = useState(false);

  // Stollar sonini QR oynasidan o'zgartirish (+1 / −1)
  const changeTables = async (delta: number) => {
    if (!qrBranch) return;
    const next = Math.max(0, Math.min(300, qrBranch.tables + delta));
    if (next === qrBranch.tables) return;
    setTablesBusy(true);
    try {
      const b = await api.admin.updateBranch(qrBranch.id, { tables: next });
      setQrBranch(b);
      haptic.select();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTablesBusy(false);
    }
  };

  const load = useCallback(() => {
    api.admin
      .branches()
      .then((r) => setBranches(r.branches))
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const toggle = async (b: AdminBranch, v: boolean) => {
    try {
      await api.admin.updateBranch(b.id, { isActive: v });
      haptic.select();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="admin__toolbar">
        <span className="muted">{branches ? `${branches.length} ta filial` : 'Yuklanmoqda…'}</span>
        <Button onClick={() => setEditing('new')}>+ Yangi filial</Button>
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>
        Yetkazish buyurtmasi mijoz manziliga eng yaqin faol filialga avtomatik tushadi. Zalda buyurtma — stoldagi QR kod yoki
        mijoz filial ichida ekanini joylashuvdan aniqlash orqali.
      </p>
      {error && <div className="form-error">⚠️ {error}</div>}
      {!branches && !error && <div className="skeleton skeleton--row" />}

      <ul className="admin-menu">
        {branches?.map((b) => (
          <li key={b.id} className={cn('admin-product branch-row', !b.isActive && 'is-off')}>
            <span className="staff-avatar">🏪</span>
            <button className="admin-product__info" onClick={() => setEditing(b)}>
              <b>{b.name}</b>
              <small>{b.address || 'Manzil kiritilmagan'}</small>
              <small>
                {b.lat !== null ? `📍 ${b.lat.toFixed(4)}, ${b.lng?.toFixed(4)}` : '⚠️ Joylashuv yoʻq — yetkazish yoʻnaltirilmaydi'} · ⏰ {b.openTime}–{b.closeTime} ·
                🛵 {b.radiusKm} km · 🪑 {b.tables}
              </small>
              {b.chatId ? <small>💬 Guruh: {b.chatId}</small> : <small>💬 Buyurtmalar umumiy admin chatga</small>}
            </button>
            <div className="branch-row__side">
              <Switch checked={b.isActive} onChange={(v) => toggle(b, v)} label="Faol" />
              {b.tables > 0 && (
                <button className="link-btn" onClick={() => setQrBranch(b)}>
                  QR
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <BranchEditor
        state={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          haptic.notify('success');
          load();
        }}
      />

      <BottomSheet open={Boolean(qrBranch)} onClose={() => setQrBranch(null)} title={qrBranch ? `${qrBranch.name} — stol QR kodlari` : 'QR'}>
        {qrBranch && (
          <>
            <p className="muted" style={{ marginBottom: 10 }}>
              Har bir stolga oʻz QR kodini chop etib qoʻying. Mijoz skanerlasa, bot shu filial va stol bilan zal menyusini ochadi.
            </p>
            <div className="tables-bar glass">
              <span>
                🪑 <b>{qrBranch.tables}</b> ta stol
              </span>
              <div>
                <Button variant="secondary" disabled={tablesBusy || qrBranch.tables === 0} onClick={() => changeTables(-1)}>
                  − Oxirgisini olib tashlash
                </Button>
                <Button loading={tablesBusy} onClick={() => changeTables(1)}>
                  + Stol qoʻshish
                </Button>
              </div>
            </div>
            <div className="qr-grid">
              {Array.from({ length: qrBranch.tables }, (_, i) => i + 1).map((n) => {
                const src = `/api/qr/table/${qrBranch.id}/${n}.png`;
                const abs = typeof window !== 'undefined' ? window.location.origin + src : src;
                return (
                  <button
                    key={n}
                    className="qr-card glass"
                    onClick={() => {
                      const wa = webApp as (typeof webApp & { downloadFile?: (p: { url: string; file_name: string }) => void }) | null;
                      if (wa?.downloadFile && wa.isVersionAtLeast('8.0')) wa.downloadFile({ url: abs + '?download=1', file_name: `stol-${n}.png` });
                      else if (wa) wa.openLink(abs);
                      else window.open(abs, '_blank');
                    }}
                  >
                    <img src={src} alt={`${n}-stol`} loading="lazy" />
                    <b>{n}-stol</b>
                    <small>⬇️ Yuklab olish</small>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}

function BranchEditor({ state, onClose, onSaved }: { state: AdminBranch | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const { webApp } = useTelegram();
  const [f, setF] = useState(EMPTY_BRANCH);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state) return;
    setError('');
    if (state === 'new') setF(EMPTY_BRANCH);
    else
      setF({
        name: state.name,
        nameRu: String(state.i18n?.ru?.name || ''),
        nameEn: String(state.i18n?.en?.name || ''),
        address: state.address,
        coords: state.lat !== null ? `${state.lat}, ${state.lng}` : '',
        phone: state.phone,
        openTime: state.openTime,
        closeTime: state.closeTime,
        radiusKm: String(state.radiusKm),
        tables: String(state.tables),
        chatId: state.chatId,
      });
  }, [state]);

  const set = (k: keyof typeof EMPTY_BRANCH) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const remove = async () => {
    if (!state || state === 'new') return;
    const text = `“${state.name}” filiali butunlay oʻchirilsinmi?\n\nEski buyurtmalar tarixda qoladi, bu filialdagi xodimlar “Barcha filiallar”ga oʻtkaziladi. Bu amalni qaytarib boʻlmaydi.`;
    const ok = await new Promise<boolean>((resolve) => (webApp ? webApp.showConfirm(text, resolve) : resolve(window.confirm(text))));
    if (!ok) return;
    setSaving(true);
    setError('');
    try {
      await api.admin.deleteBranch(state.id);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const { lat, lng } = await getPosition(webApp);
      setF((x) => ({ ...x, coords: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
    } catch {
      setError('Joylashuvni olib boʻlmadi — koordinatalarni qoʻlda kiriting');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const i18n: I18nMap = {};
    if (f.nameRu.trim()) i18n.ru = { name: f.nameRu.trim() };
    if (f.nameEn.trim()) i18n.en = { name: f.nameEn.trim() };
    const payload: Record<string, unknown> = {
      name: f.name,
      i18n,
      address: f.address,
      phone: f.phone,
      openTime: f.openTime,
      closeTime: f.closeTime,
      radiusKm: Number(f.radiusKm),
      tables: Number(f.tables),
      chatId: f.chatId,
    };
    if (f.coords.trim()) payload.coords = f.coords;
    else payload.lat = null;
    if (!f.coords.trim()) payload.lng = null;
    try {
      if (state && state !== 'new') await api.admin.updateBranch(state.id, payload);
      else await api.admin.createBranch(payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={Boolean(state)}
      onClose={onClose}
      title={state === 'new' ? 'Yangi filial' : 'Filialni tahrirlash'}
      footer={
        <div className="sticky-cta sticky-cta--column">
          {error && <div className="form-error">⚠️ {error}</div>}
          <Button size="lg" block loading={saving} onClick={save}>
            Saqlash
          </Button>
        </div>
      }
    >
      <Input label="Filial nomi" value={f.name} onChange={set('name')} placeholder="Masalan: Chilonzor" />
      <div className="admin-editor__row">
        <Input label="Nomi (RU)" value={f.nameRu} onChange={set('nameRu')} placeholder="Чиланзар" />
        <Input label="Nomi (EN)" value={f.nameEn} onChange={set('nameEn')} placeholder="Chilanzar" />
      </div>
      <Textarea label="Manzil" value={f.address} onChange={set('address')} placeholder="Toshkent, Chilonzor 9-kvartal, 15-uy" />

      <Input
        label="Joylashuv (Google/Yandex xarita havolasi yoki 41.31, 69.27)"
        value={f.coords}
        onChange={set('coords')}
        placeholder="41.2756, 69.2034"
        hint={
          <button type="button" className="link-btn" onClick={useMyLocation} disabled={locating}>
            {locating ? 'Aniqlanmoqda…' : '📍 Hozir filialdaman — joylashuvimni olish'}
          </button>
        }
      />
      {f.coords && /\d/.test(f.coords) && (
        <a className="link-btn" href={`https://maps.google.com/?q=${encodeURIComponent(f.coords)}`} target="_blank" rel="noreferrer">
          🗺 Xaritada tekshirish
        </a>
      )}

      <Input label="Telefon" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="+998 71 200 00 00" />
      <div className="admin-editor__row">
        <Input label="Ochiladi" type="time" value={f.openTime} onChange={set('openTime')} />
        <Input label="Yopiladi" type="time" value={f.closeTime} onChange={set('closeTime')} />
      </div>
      <div className="admin-editor__row">
        <Input label="Yetkazish radiusi (km)" inputMode="decimal" value={f.radiusKm} onChange={set('radiusKm')} />
        <Input label="Stollar soni (QR uchun)" inputMode="numeric" value={f.tables} onChange={set('tables')} />
      </div>
      <Input
        label="Filial guruhi chat ID (ixtiyoriy)"
        value={f.chatId}
        onChange={set('chatId')}
        placeholder="-1001234567890"
        hint={<span className="muted">Botni filial guruhiga qoʻshing va ID ni yozing (@RawDataBot bilan bilish mumkin). Boʻsh boʻlsa — umumiy admin chatga.</span>}
      />

      {state && state !== 'new' && (
        <button className="sort-item sort-item--danger" style={{ marginTop: 16, width: '100%' }} onClick={remove}>
          🗑 Filialni oʻchirish
        </button>
      )}
    </BottomSheet>
  );
}

/* ================= Kategoriyalar ================= */

const CATEGORY_EMOJIS = ['🍕', '🔥', '👑', '🥩', '🧀', '🥦', '🌶', '🍗', '🍔', '🥤', '🍰', '🍟', '🥗', '🧒', '⭐️', '🆕'];

function CategoriesManager({ onChanged }: { onChanged: () => void }) {
  const { haptic, webApp } = useTelegram();
  const [list, setList] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);
  const [form, setForm] = useState({ title: '', emoji: '🍕', ru: '', en: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.admin
      .categories()
      .then(setList)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const open = (c: AdminCategory | 'new') => {
    setError('');
    setEditing(c);
    setForm(
      c === 'new'
        ? { title: '', emoji: '🍕', ru: '', en: '' }
        : { title: c.title, emoji: c.emoji, ru: String(c.i18n?.ru?.title || ''), en: String(c.i18n?.en?.title || '') }
    );
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const i18n: I18nMap = {};
    if (form.ru.trim()) i18n.ru = { title: form.ru.trim() };
    if (form.en.trim()) i18n.en = { title: form.en.trim() };
    try {
      const data = { title: form.title, emoji: form.emoji, i18n };
      if (editing && editing !== 'new') await api.admin.updateCategory(editing.id, data);
      else await api.admin.createCategory(data);
      haptic.notify('success');
      setEditing(null);
      load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: AdminCategory) => {
    const text = `“${c.title}” kategoriyasi oʻchirilsinmi? Pitsalar oʻchmaydi — faqat bu kategoriyadan chiqariladi.`;
    const ok = await new Promise<boolean>((resolve) => (webApp ? webApp.showConfirm(text, resolve) : resolve(window.confirm(text))));
    if (!ok) return;
    try {
      await api.admin.deleteCategory(c.id);
      haptic.notify('success');
      setEditing(null);
      load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggle = async (c: AdminCategory, v: boolean) => {
    setList((l) => l?.map((x) => (x.id === c.id ? { ...x, isActive: v } : x)) || null);
    try {
      await api.admin.updateCategory(c.id, { isActive: v });
      haptic.select();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  return (
    <>
      <div className="section-head">
        <h3 className="section-title">🗂 Kategoriyalar</h3>
        <button className="section-link" onClick={() => open('new')}>
          + Yangi kategoriya
        </button>
      </div>
      {error && !editing && <div className="form-error">⚠️ {error}</div>}
      {!list && !error && <div className="skeleton skeleton--row" />}
      <ul className="admin-menu">
        {list?.map((c) => (
          <li key={c.id} className={cn('admin-product cat-row', !c.isActive && 'is-off')}>
            <span className="cat-row__emoji">{c.emoji}</span>
            <button className="admin-product__info" onClick={() => open(c)}>
              <b>{c.title}</b>
              <small>
                {c.products ?? 0} ta mahsulot
                {c.i18n?.ru?.title ? ` · RU: ${c.i18n.ru.title}` : ''}
                {c.i18n?.en?.title ? ` · EN: ${c.i18n.en.title}` : ''} · ✏️
              </small>
            </button>
            <Switch checked={c.isActive} onChange={(v) => toggle(c, v)} label="Menyuda koʻrsatish" />
          </li>
        ))}
      </ul>

      <BottomSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Yangi kategoriya' : 'Kategoriyani tahrirlash'}
        footer={
          <div className="sticky-cta sticky-cta--column">
            {error && <div className="form-error">⚠️ {error}</div>}
            <Button size="lg" block loading={saving} onClick={save}>
              Saqlash
            </Button>
          </div>
        }
      >
        <div className="field" style={{ marginTop: 0 }}>
          <span className="field__label">Belgi</span>
          <div className="emoji-grid">
            {CATEGORY_EMOJIS.map((e) => (
              <button key={e} type="button" className={cn('emoji-grid__item', form.emoji === e && 'is-active')} onClick={() => setForm((f) => ({ ...f, emoji: e }))}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <Input label="Nomi (oʻzbekcha)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Masalan: Ichimliklar" />
        <div className="admin-editor__row">
          <Input label="Nomi (RU)" value={form.ru} onChange={(e) => setForm((f) => ({ ...f, ru: e.target.value }))} placeholder="Напитки" />
          <Input label="Nomi (EN)" value={form.en} onChange={(e) => setForm((f) => ({ ...f, en: e.target.value }))} placeholder="Drinks" />
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Mahsulotni kategoriyaga qoʻshish uchun mahsulotni tahrirlash oynasida kategoriyani belgilang.
        </p>
        {editing && editing !== 'new' && (
          <button className="sort-item sort-item--danger" style={{ marginTop: 14, width: '100%' }} onClick={() => remove(editing)}>
            🗑 Kategoriyani oʻchirish
          </button>
        )}
      </BottomSheet>
    </>
  );
}

/* ================= Storislar ================= */

const STORY_GRADIENTS: Array<[string, string]> = [
  ['#FF5A36', '#FF9A3C'],
  ['#E0483A', '#A91F15'],
  ['#7B2FF7', '#F107A3'],
  ['#0F9D58', '#53D27A'],
  ['#1565C0', '#42A5F5'],
  ['#3A2618', '#A0703C'],
  ['#F4AD3D', '#D8701A'],
  ['#232526', '#414345'],
];

const STORY_EMOJIS = ['🔥', '⭐️', '⏱', '🍄', '💬', '🎉', '🎁', '🍕', '🛵', '❤️', '🆕', '👑', '🧀', '🥤', '📢', '💯'];

const STORY_TYPES: Array<{ id: AdminStory['type']; title: string }> = [
  { id: 'promo', title: '🔥 Aksiya' },
  { id: 'review', title: '⭐️ Sharh' },
  { id: 'case', title: '📊 Natija' },
];

const EMPTY_STORY: StoryInput = {
  title: '',
  emoji: '🔥',
  type: 'promo',
  gradient: ['#E0483A', '#A91F15'],
  heading: '',
  text: '',
  rating: null,
  ctaLabel: '',
  ctaAction: '',
  image: '',
  i18n: {},
};

function StoriesSection() {
  const { haptic } = useTelegram();
  const [list, setList] = useState<AdminStory[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AdminStory | 'new' | null>(null);

  const load = useCallback(() => {
    api.admin
      .stories()
      .then(setList)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const move = async (index: number, dir: -1 | 1) => {
    if (!list) return;
    const next = [...list];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setList(next);
    haptic.select();
    try {
      setList(await api.admin.reorderStories(next.map((s) => s.id)));
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  const toggle = async (s: AdminStory, v: boolean) => {
    setList((l) => l?.map((x) => (x.id === s.id ? { ...x, isActive: v } : x)) || null);
    try {
      await api.admin.updateStory(s.id, { isActive: v });
      haptic.select();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  return (
    <>
      <div className="admin__toolbar">
        <span className="muted">{list ? `${list.length} ta storis` : 'Yuklanmoqda…'}</span>
        <Button onClick={() => setEditing('new')}>+ Yangi storis</Button>
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>
        Bosh sahifa tepasidagi doiralar. ▲▼ bilan tartibni oʻzgartiring; mijoz koʻrmagan storislar baribir oldinda turadi.
      </p>
      {error && <div className="form-error">⚠️ {error}</div>}
      {!list && !error && <div className="skeleton skeleton--row" />}

      <ul className="admin-menu">
        {list?.map((s, i) => (
          <li key={s.id} className={cn('admin-product', !s.isActive && 'is-off')}>
            <div className="story-row__move">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yuqoriga">
                ▲
              </button>
              <button onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Pastga">
                ▼
              </button>
            </div>
            <span className="story-row__thumb" style={{ background: `linear-gradient(135deg, ${s.gradient[0]}, ${s.gradient[1]})` }}>
              {s.image ? <img src={s.image} alt="" /> : s.emoji}
            </span>
            <button className="admin-product__info" onClick={() => setEditing(s)}>
              <b>{s.title}</b>
              <small style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.heading}</small>
              <small>
                {STORY_TYPES.find((t) => t.id === s.type)?.title} {s.image ? '· 🖼 rasm' : ''} {s.ctaAction ? '· 🔘 tugma' : ''} · ✏️
              </small>
            </button>
            <Switch checked={s.isActive} onChange={(v) => toggle(s, v)} label="Koʻrsatish" />
          </li>
        ))}
      </ul>

      <StoryEditor
        state={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          haptic.notify('success');
          load();
        }}
      />
    </>
  );
}

function StoryEditor({ state, onClose, onSaved }: { state: AdminStory | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const { webApp } = useTelegram();
  const [form, setForm] = useState<StoryInput>(EMPTY_STORY);
  const [preview, setPreview] = useState(''); // ko'rinadigan rasm (yuklangan yoki tanlangan)
  const [upload, setUpload] = useState<string | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.admin
      .products()
      .then((r) => {
        setProducts(r.products);
        setCategories(r.categories);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!state) return;
    setError('');
    setUpload(null);
    if (state === 'new') {
      setForm(EMPTY_STORY);
      setPreview('');
    } else {
      setForm({ ...state });
      setPreview(state.image);
    }
  }, [state]);

  const set = <K extends keyof StoryInput>(k: K, v: StoryInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const images = useMemo(
    () => Array.from(new Set(['/images/hero.jpg', '/images/promo.jpg', '/images/onboarding.jpg', ...products.map((p) => p.image)])),
    [products]
  );

  const action = form.ctaAction || '';
  const actionType = !action
    ? 'none'
    : action.startsWith('category:')
      ? 'category'
      : action.startsWith('product:')
        ? 'product'
        : action.startsWith('url:')
          ? 'url'
          : action;

  const onFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      let data = await resizeToDataUrl(file, 1080, 0.8);
      if (data.length > 440 * 1024) data = await resizeToDataUrl(file, 800, 0.7);
      setUpload(data);
      setPreview(data);
    } catch {
      setError('Rasmni oʻqib boʻlmadi');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const payload: StoryInput = {
      title: form.title,
      emoji: form.emoji,
      type: form.type,
      gradient: form.gradient,
      heading: form.heading,
      text: form.text,
      rating: form.type === 'review' ? form.rating || 5 : null,
      ctaLabel: form.ctaAction ? form.ctaLabel : '',
      ctaAction: form.ctaAction,
      i18n: form.i18n,
    };
    if (upload) payload.imageUpload = upload;
    else if (state === 'new' || (state && preview !== state.image)) payload.image = preview && !preview.startsWith('/api/') ? preview : '';
    try {
      if (state && state !== 'new') await api.admin.updateStory(state.id, payload);
      else await api.admin.createStory(payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!state || state === 'new') return;
    const text = `“${state.title}” storisi oʻchirilsinmi?`;
    const ok = await new Promise<boolean>((resolve) => (webApp ? webApp.showConfirm(text, resolve) : resolve(window.confirm(text))));
    if (!ok) return;
    try {
      await api.admin.deleteStory(state.id);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const g = (form.gradient || ['#E0483A', '#A91F15']) as [string, string];

  return (
    <BottomSheet
      open={Boolean(state)}
      onClose={onClose}
      title={state === 'new' ? 'Yangi storis' : 'Storisni tahrirlash'}
      footer={
        <div className="sticky-cta sticky-cta--column">
          {error && <div className="form-error">⚠️ {error}</div>}
          <Button size="lg" block loading={saving} onClick={save}>
            Saqlash
          </Button>
        </div>
      }
    >
      {/* Jonli ko'rinish */}
      <div className="story-preview" style={{ background: `linear-gradient(160deg, ${g[0]}, ${g[1]})` }}>
        {preview && <img src={preview} alt="" />}
        {preview && <div className="story-preview__shade" />}
        {!preview && <div className="story-preview__emoji">{form.emoji}</div>}
        {form.type === 'review' && <div className="story-viewer__stars">{'★'.repeat(form.rating || 5)}</div>}
        <h4>{form.heading || 'Sarlavha'}</h4>
        {form.text && <p>{form.text}</p>}
        {form.ctaAction && <span className="story-preview__cta">{form.ctaLabel || 'Tugma'} →</span>}
      </div>

      <div className="field">
        <span className="field__label">Turi</span>
        <div className="admin-editor__cats">
          {STORY_TYPES.map((t) => (
            <button key={t.id} type="button" className={cn('chip-tag', form.type === t.id && 'is-active')} onClick={() => set('type', t.id)}>
              {t.title}
            </button>
          ))}
        </div>
      </div>
      {form.type === 'review' && (
        <div className="field">
          <span className="field__label">Yulduzlar</span>
          <div className="admin-editor__cats">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className={cn('chip-tag', (form.rating || 5) === n && 'is-active')} onClick={() => set('rating', n)}>
                {'★'.repeat(n)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Input label="Doira ostidagi nom (qisqa)" value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Masalan: −25%" />
      <Textarea label="Sarlavha" value={form.heading || ''} onChange={(e) => set('heading', e.target.value)} placeholder="Bugun barcha pitsalarga 25% chegirma" />
      <Textarea label="Matn" value={form.text || ''} onChange={(e) => set('text', e.target.value)} placeholder="Qisqa tushuntirish yoki mijoz ismi" />

      <div className="field">
        <span className="field__label">Belgi (rasm boʻlmasa doirada koʻrinadi)</span>
        <div className="emoji-grid">
          {STORY_EMOJIS.map((e) => (
            <button key={e} type="button" className={cn('emoji-grid__item', form.emoji === e && 'is-active')} onClick={() => set('emoji', e)}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Fon rangi</span>
        <div className="gradient-swatches">
          {STORY_GRADIENTS.map((pair) => (
            <button
              key={pair.join()}
              type="button"
              className={cn('gradient-swatch', g[0] === pair[0] && g[1] === pair[1] && 'is-active')}
              style={{ background: `linear-gradient(135deg, ${pair[0]}, ${pair[1]})` }}
              onClick={() => set('gradient', pair)}
              aria-label={pair.join(' ')}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Rasm (ixtiyoriy) — telefoningizdan yuklang yoki tanlang</span>
        <div className="admin-editor__images">
          <button type="button" className="upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Rasm yuklash">
            {uploading ? '…' : '📷'}
          </button>
          <button
            type="button"
            className={cn('admin-editor__img', !preview && 'is-active')}
            onClick={() => {
              setPreview('');
              setUpload(null);
            }}
            style={{ display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}
          >
            Rasmsiz
          </button>
          {upload && (
            <button type="button" className={cn('admin-editor__img', preview === upload && 'is-active')} onClick={() => setPreview(upload)}>
              <img src={upload} alt="" />
            </button>
          )}
          {images.map((src) => (
            <button
              key={src}
              type="button"
              className={cn('admin-editor__img', preview === src && 'is-active')}
              onClick={() => {
                setPreview(src);
                setUpload(null);
              }}
            >
              <img src={thumb(src)} alt="" />
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      <div className="field">
        <span className="field__label">Tugma (ixtiyoriy)</span>
        <div className="admin-editor__cats">
          {(
            [
              ['none', 'Tugmasiz'],
              ['catalog', 'Katalog'],
              ['category', 'Kategoriya'],
              ['product', 'Pitsa'],
              ['bonus', 'Bonuslar'],
              ['cart', 'Savatcha'],
              ['url', 'Havola'],
            ] as Array<[string, string]>
          ).map(([id, title]) => (
            <button
              key={id}
              type="button"
              className={cn('chip-tag', actionType === id && 'is-active')}
              onClick={() =>
                set(
                  'ctaAction',
                  id === 'none'
                    ? ''
                    : id === 'category'
                      ? `category:${categories[0]?.id || 'hit'}`
                      : id === 'product'
                        ? `product:${products[0]?.id || ''}`
                        : id === 'url'
                          ? 'url:https://'
                          : id
                )
              }
            >
              {title}
            </button>
          ))}
        </div>
      </div>
      {actionType === 'category' && (
        <div className="admin-editor__cats" style={{ marginTop: 8 }}>
          {categories.map((c) => (
            <button key={c.id} type="button" className={cn('chip-tag', action === `category:${c.id}` && 'is-active')} onClick={() => set('ctaAction', `category:${c.id}`)}>
              {c.emoji} {c.title}
            </button>
          ))}
        </div>
      )}
      {actionType === 'product' && (
        <div className="admin-editor__images" style={{ marginTop: 8 }}>
          {products.map((p) => (
            <button key={p.id} type="button" className={cn('admin-editor__img', action === `product:${p.id}` && 'is-active')} onClick={() => set('ctaAction', `product:${p.id}`)} title={p.name}>
              <img src={thumb(p.image)} alt={p.name} />
            </button>
          ))}
        </div>
      )}
      {actionType === 'url' && <Input label="Havola (https://…)" value={action.slice(4)} onChange={(e) => set('ctaAction', `url:${e.target.value.trim()}`)} />}
      {actionType !== 'none' && <Input label="Tugma matni" value={form.ctaLabel || ''} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="Masalan: Buyurtma berish" />}

      <I18nFields
        value={form.i18n || {}}
        onChange={(v) => set('i18n', v)}
        fields={[
          { key: 'title', label: 'Doira ostidagi nom' },
          { key: 'heading', label: 'Sarlavha', area: true },
          { key: 'text', label: 'Matn', area: true },
          ...(actionType !== 'none' ? [{ key: 'ctaLabel', label: 'Tugma matni' }] : []),
        ]}
      />

      {state && state !== 'new' && (
        <button className="sort-item sort-item--danger" style={{ marginTop: 14, width: '100%' }} onClick={remove}>
          🗑 Storisni oʻchirish
        </button>
      )}
    </BottomSheet>
  );
}
