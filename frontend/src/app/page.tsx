'use client';

// Bosh sahifa: onboarding -> asosiy / katalog / savatcha / bonuslar / profil
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomNavigation, { type Tab } from '@/components/layout/BottomNavigation';
import AdminPanel from '@/components/features/AdminPanel';
import BannerDetails from '@/components/features/BannerDetails';
import CartScreen from '@/components/features/CartScreen';
import CatalogScreen from '@/components/features/CatalogScreen';
import CheckoutSheet, { type CheckoutForm } from '@/components/features/CheckoutSheet';
import HomeScreen from '@/components/features/HomeScreen';
import Onboarding from '@/components/features/Onboarding';
import LanguagePicker from '@/components/features/LanguagePicker';
import Splash from '@/components/ui/Splash';
import OrderSuccess from '@/components/features/OrderSuccess';
import ProductSheet from '@/components/features/ProductSheet';
import Profile from '@/components/features/Profile';
import RewardsScreen from '@/components/features/RewardsScreen';
import Button from '@/components/ui/Button';
import { useCart } from '@/hooks/useCart';
import { useCartStore } from '@/store/cartStore';
import { useTelegram } from '@/hooks/useTelegram';
import { api, type Address, type Banner, type Catalog, type Me, type OrderHistoryItem, type Product } from '@/lib/api';
import { normalizeLang, useLangStore, useT, type Lang } from '@/lib/i18n';
import { safeStorage } from '@/lib/utils';

const ONBOARDING_KEY = 'pizza-onboarded';

export default function HomePage() {
  const { webApp, user, haptic } = useTelegram();
  const { t, lang } = useT();
  const setLangStore = useLangStore((s) => s.setLang);
  const langChosen = useLangStore((s) => s.chosen);

  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [category, setCategory] = useState('all');
  const [focusSearch, setFocusSearch] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [wantAdmin, setWantAdmin] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [bannerDetails, setBannerDetails] = useState<Banner | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [success, setSuccess] = useState<{ orderId: number; total: number; paid: boolean; dineIn?: boolean; branch?: string } | null>(null);
  const [toast, setToast] = useState('');
  const [coinsRefresh, setCoinsRefresh] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cart = useCart(catalog);

  // ---- Onboarding faqat bir marta (localStorage + Telegram CloudStorage) ----
  useEffect(() => {
    if (safeStorage.get(ONBOARDING_KEY) === '1') return setOnboarded(true);
    const cloud = webApp?.isVersionAtLeast('6.9') ? webApp.CloudStorage : null;
    if (!cloud) return setOnboarded(false);
    cloud.getItem(ONBOARDING_KEY, (err, value) => {
      const done = !err && value === '1';
      if (done) safeStorage.set(ONBOARDING_KEY, '1');
      setOnboarded(done);
    });
  }, [webApp]);

  const finishOnboarding = () => {
    safeStorage.set(ONBOARDING_KEY, '1');
    if (webApp?.isVersionAtLeast('6.9')) webApp.CloudStorage.setItem(ONBOARDING_KEY, '1');
    setOnboarded(true);
  };

  // ---- Ma'lumotlarni yuklash ----
  const loadCatalog = useCallback(() => {
    setCatalogError('');
    api
      .getCatalog(useLangStore.getState().lang)
      .then(setCatalog)
      .catch((e: Error) => setCatalogError(e.message));
  }, []);

  const loadMe = useCallback(() => {
    api
      .getMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setMeLoaded(true));
  }, []);

  const loadAddresses = useCallback(() => {
    api
      .addresses()
      .then(setAddresses)
      .catch(() => setAddresses([]));
  }, []);

  // Birinchi ochilishda til — Telegram tilidan (keyin serverdagi tanlov ustun)
  useEffect(() => {
    if (!langChosen && user?.language_code) setLangStore(normalizeLang(user.language_code), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    loadMe();
    loadAddresses();
    const params = new URLSearchParams(window.location.search);
    // /admin buyrug'idagi tugma Mini App'ni ?admin=1 bilan ochadi
    if (params.get('admin') === '1') setWantAdmin(true);
    // Stoldagi QR: ?dinein=<filial>&table=<stol> yoki startapp=t_<filial>_<stol>
    const startParam = webApp?.initDataUnsafe?.start_param || '';
    const m = /^t_(\d+)_(\d+)$/.exec(startParam);
    const dineBranch = params.get('dinein') || m?.[1];
    const dineTable = params.get('table') || m?.[2];
    if (dineBranch) useCartStore.getState().setDineIn(Number(dineBranch), dineTable || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMe, loadAddresses]);

  // Til o'zgarsa — katalog shu tilda qayta yuklanadi
  useEffect(() => {
    loadCatalog();
  }, [lang, loadCatalog]);

  // Serverda saqlangan til ustun
  useEffect(() => {
    const st = useLangStore.getState();
    if (me?.lang && (me.lang !== st.lang || !st.chosen)) setLangStore(me.lang, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.lang]);

  const changeLang = (l: Lang) => {
    setLangStore(l);
    setMe((m) => (m ? { ...m, lang: l } : m));
    api.setLang(l).catch(() => undefined);
  };

  useEffect(() => {
    if (wantAdmin && me?.isAdmin) {
      setAdminOpen(true);
      setWantAdmin(false);
    }
  }, [wantAdmin, me]);

  const closeAdmin = useCallback(() => {
    setAdminOpen(false);
    loadCatalog(); // menyu, reklama yoki sozlamalar o'zgargan bo'lishi mumkin
    loadMe();
  }, [loadCatalog, loadMe]);

  // Tanlangan yetkazish manzili (yo'q bo'lsa — asosiy manzil)
  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === cart.addressId) || addresses.find((a) => a.isDefault) || addresses[0] || null,
    [addresses, cart.addressId]
  );

  // Ekran almashganda tepaga qaytish
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const showToast = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  const addToCart = (p: Product, qty = 1) => {
    cart.add(p.id, qty);
    haptic.impact('light');
    showToast(t('added', { name: p.name }));
  };

  // Storis va reklama tugmalari: catalog | cart | bonus | category:<id> | product:<id> | url:https://...
  const runAction = (action: string) => {
    if (action === 'catalog') {
      setCategory('all');
      return setTab('catalog');
    }
    if (action === 'cart') return setTab('cart');
    if (action === 'bonus') return setTab('rewards');
    if (action.startsWith('category:')) {
      setCategory(action.slice(9));
      return setTab('catalog');
    }
    if (action.startsWith('product:')) {
      const product = catalog?.products.find((p) => p.id === action.slice(8));
      if (product) setSelected(product);
      else setTab('catalog');
      return;
    }
    if (action.startsWith('url:')) {
      const url = action.slice(4);
      if (webApp) webApp.openLink(url);
      else window.open(url, '_blank');
    }
  };

  const openBanner = (b: Banner) => {
    haptic.impact('light');
    if (b.action === 'details') setBannerDetails(b);
    else runAction(b.action);
  };

  const reorder = (items: OrderHistoryItem['items']) => {
    items.forEach((i) => cart.add(i.productId, i.qty));
    haptic.notify('success');
    setTab('cart');
  };

  // ---- Buyurtma berish ----
  const finishOrder = (orderId: number, total: number, paid: boolean, branch?: string) => {
    haptic.notify('success');
    cart.clear();
    setSubmitting(false);
    setCheckoutOpen(false);
    setSuccess({ orderId, total, paid, dineIn: cart.orderType === 'dinein', branch });
    loadMe();
    setCoinsRefresh((n) => n + 1);
  };

  const submitOrder = async (form: CheckoutForm) => {
    setSubmitting(true);
    setCheckoutError('');
    try {
      if (form.addressId) cart.setAddressId(form.addressId);
      const dineIn = cart.orderType === 'dinein';
      const res = await api.createOrder({
        orderType: cart.orderType,
        branchId: dineIn ? cart.dineBranchId ?? undefined : undefined,
        tableNo: dineIn ? Number(cart.tableNo) : undefined,
        items: cart.lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        rewards: cart.rewardLines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        bumpAdded: cart.bumpAdded,
        paymentMethod: cart.paymentMethod,
        fullName: form.fullName,
        phone: form.phone,
        addressId: dineIn ? undefined : form.addressId,
        comment: form.comment,
      });

      if (!res.invoiceLink) {
        finishOrder(res.orderId, res.total, false, res.branch?.name);
        return;
      }

      // Telegram Stars yoki Click/Payme — bir bosishda to'lov oynasi
      if (!webApp) {
        window.open(res.invoiceLink, '_blank');
        setSubmitting(false);
        return;
      }
      webApp.openInvoice(res.invoiceLink, (status) => {
        setSubmitting(false);
        if (status === 'paid') finishOrder(res.orderId, res.total, true, res.branch?.name);
        else if (status === 'cancelled') setCheckoutError(t('pay_cancelled'));
        else if (status === 'failed') {
          haptic.notify('error');
          setCheckoutError(t('pay_failed'));
        }
      });
    } catch (e) {
      haptic.notify('error');
      setCheckoutError((e as Error).message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  };

  // ---- Render ----
  // Til hali tanlanmagan (birinchi ochilish) — avval til so'raladi
  const needLang = !langChosen && meLoaded && !me?.lang;
  if (onboarded === null || (!langChosen && !meLoaded)) return <Splash />;
  if (needLang) {
    return (
      <LanguagePicker
        onPick={(l) => {
          setLangStore(l, true);
          setMe((m) => (m ? { ...m, lang: l } : m));
          api.setLang(l).catch(() => undefined);
        }}
      />
    );
  }
  if (!onboarded) return <Onboarding onFinish={finishOnboarding} onLangChange={(l) => api.setLang(l).catch(() => undefined)} />;

  if (!catalog) {
    return (
      <main className="app">
        {catalogError ? (
          <div className="empty">
            <div className="empty__icon">😕</div>
            <h2 className="empty__title">{t('menu_error')}</h2>
            <p className="muted">{catalogError}</p>
            <Button onClick={loadCatalog}>{t('retry')}</Button>
          </div>
        ) : (
          <Splash />
        )}
      </main>
    );
  }

  const payment = catalog.paymentMethods.find((m) => m.id === cart.paymentMethod);

  return (
    <main className="app">
      {tab === 'home' && (
        <HomeScreen
          catalog={catalog}
          cartCount={cart.count}
          ordersCount={me?.ordersCount}
          avatar={me?.avatar}
          qtyOf={cart.qtyOf}
          onOpenProduct={setSelected}
          onAdd={(p) => addToCart(p)}
          onGoCatalog={(cat = 'all', search = false) => {
            setCategory(cat);
            setFocusSearch(search);
            setTab('catalog');
          }}
          onGoCart={() => setTab('cart')}
          onGoProfile={() => setTab('profile')}
          onAction={runAction}
          onBanner={openBanner}
          addresses={addresses}
          selectedAddress={selectedAddress}
          onSelectAddress={(a) => cart.setAddressId(a.id)}
          onAddressesChanged={loadAddresses}
        />
      )}

      {tab === 'catalog' && (
        <CatalogScreen
          catalog={catalog}
          category={category}
          onCategoryChange={setCategory}
          qtyOf={cart.qtyOf}
          onOpen={setSelected}
          onAdd={(p) => addToCart(p)}
          cartCount={cart.count}
          cartTotal={cart.total}
          onGoCart={() => setTab('cart')}
          autoFocusSearch={focusSearch}
        />
      )}

      {tab === 'cart' && (
        <CartScreen
          catalog={catalog}
          cart={cart}
          onGoCatalog={() => setTab('catalog')}
          onCheckout={() => {
            const method = catalog.paymentMethods.find((m) => m.id === cart.paymentMethod);
            if (!method?.enabled) {
              haptic.notify('warning');
              showToast(t('choose_payment'));
              return;
            }
            if (me && cart.coinsCost > me.coins) {
              haptic.notify('warning');
              showToast(t('coins_short', { need: cart.coinsCost, have: me.coins }));
              return;
            }
            if (cart.orderType === 'dinein' && (!cart.dineBranchId || !cart.tableNo)) {
              haptic.notify('warning');
              showToast(t('dine_need'));
              return;
            }
            haptic.impact('medium');
            setCheckoutError('');
            setCheckoutOpen(true);
          }}
        />
      )}

      {tab === 'rewards' && (
        <RewardsScreen
          catalog={catalog}
          coinsCost={cart.coinsCost}
          rewardQtyOf={cart.rewardQtyOf}
          onAddReward={(p) => {
            cart.addReward(p.id);
            showToast(t('reward_added', { name: p.name }));
          }}
          onBannerAction={openBanner}
          onGoCart={() => setTab('cart')}
          refreshKey={coinsRefresh}
        />
      )}

      {tab === 'profile' && (
        <Profile
          me={me}
          addresses={addresses}
          supportUsername={catalog.supportUsername}
          onReorder={reorder}
          onOpenAdmin={() => setAdminOpen(true)}
          onOpenRewards={() => setTab('rewards')}
          onMeChanged={loadMe}
          onAddressesChanged={loadAddresses}
          onLangChange={changeLang}
        />
      )}

      <ProductSheet
        product={selected}
        onClose={() => setSelected(null)}
        onAdd={(p, qty) => {
          addToCart(p, qty);
          setSelected(null);
        }}
      />

      <BannerDetails
        banner={bannerDetails}
        onClose={() => setBannerDetails(null)}
        onOrder={() => {
          setBannerDetails(null);
          setCategory('all');
          setTab('catalog');
        }}
      />

      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        me={me}
        orderType={cart.orderType}
        dineBranch={catalog.branches?.find((b) => b.id === cart.dineBranchId) || null}
        tableNo={cart.tableNo}
        addresses={addresses}
        selectedAddressId={selectedAddress?.id ?? null}
        onSelectAddress={(id) => cart.setAddressId(id)}
        onAddressesChanged={loadAddresses}
        total={cart.total}
        totalStars={cart.totalStars}
        coinsCost={cart.coinsCost}
        payment={payment}
        submitting={submitting}
        error={checkoutError}
        onSubmit={submitOrder}
      />

      {success && (
        <OrderSuccess
          {...success}
          onClose={() => {
            setSuccess(null);
            setTab('home');
          }}
        />
      )}

      {adminOpen && me?.isAdmin && <AdminPanel me={me} onClose={closeAdmin} />}

      {toast && <div className="toast">{toast}</div>}

      <BottomNavigation
        active={tab}
        onChange={(t) => {
          setFocusSearch(false);
          setTab(t);
        }}
        cartCount={cart.count}
        coinsEnabled={catalog.settings?.coinsEnabled ?? false}
      />
    </main>
  );
}
