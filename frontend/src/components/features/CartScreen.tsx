'use client';

// 5-bosqich: savatcha — buyurtma turi (yetkazish / zalda), Order Stack, Order Bump, jami, to'lov va buyurtma
import { useEffect, useRef, useState } from 'react';
import { getPosition, locationGranted } from '@/components/features/AddressBook';
import CartList from '@/components/features/CartList';
import OrderBump from '@/components/features/OrderBump';
import PaymentMethods from '@/components/features/PaymentMethods';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { useCart } from '@/hooks/useCart';
import { useTelegram } from '@/hooks/useTelegram';
import { api, type Catalog } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { cn, formatPrice, formatStars, thumb } from '@/lib/utils';

type Props = {
  catalog: Catalog;
  cart: ReturnType<typeof useCart>;
  onCheckout: () => void;
  onGoCatalog: () => void;
};

export default function CartScreen({ catalog, cart, onCheckout, onGoCatalog }: Props) {
  const { t } = useT();

  if (cart.count === 0) {
    return (
      <div className="screen">
        <div className="empty">
          <div className="empty__icon">🛒</div>
          <h2 className="empty__title">{t('cart_empty')}</h2>
          <p className="muted">{t('cart_empty_s')}</p>
          <Button size="lg" onClick={onGoCatalog}>
            {t('to_catalog')}
          </Button>
        </div>
      </div>
    );
  }

  const dineIn = cart.orderType === 'dinein';
  const freeFrom = catalog.delivery.freeFrom;
  const progress = Math.min(100, Math.round((cart.subtotal / freeFrom) * 100));

  return (
    <div className="screen screen--cart">
      <div className="screen__head">
        <h1 className="screen__title">{t('cart_title')}</h1>
        <p className="muted">{t('cart_sub')}</p>
      </div>

      <OrderTypePanel catalog={catalog} cart={cart} />

      <CartList lines={cart.lines} onIncrement={cart.increment} onDecrement={cart.decrement} onRemove={cart.remove} />

      {cart.rewardLines.length > 0 && (
        <>
          <h3 className="section-title">{t('rewards_in_cart')}</h3>
          <ul className="cart-list">
            {cart.rewardLines.map((l) => (
              <li className="cart-item cart-item--reward" key={l.product.id}>
                <img className="cart-item__img" src={thumb(l.product.image)} alt="" />
                <div className="cart-item__info">
                  <div className="cart-item__name">
                    {l.product.name} × {l.qty}
                  </div>
                  <div className="cart-item__price">
                    <span className="price__new">
                      🪙 {l.coins} {t('coin')}
                    </span>
                    <span className="price__old">{formatPrice(l.product.price * l.qty, false)}</span>
                  </div>
                </div>
                <button className="cart-item__remove" onClick={() => cart.removeReward(l.product.id)} aria-label={t('remove')}>
                  🗑
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {!dineIn && (
        <div className="delivery-progress">
          {cart.leftForFreeDelivery > 0 ? (
            <span>{t('free_left', { sum: formatPrice(cart.leftForFreeDelivery) })}</span>
          ) : (
            <span>{t('free_yes')}</span>
          )}
          <div className="delivery-progress__bar">
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {cart.paidCount > 0 && <OrderBump bump={catalog.orderBump} checked={cart.bumpAdded} onChange={cart.setBump} />}

      <div className="summary">
        <div className="summary__row">
          <span>{t('items_n', { n: cart.paidCount })}</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>
        {cart.bumpPrice > 0 && (
          <div className="summary__row">
            <span>{t('extra_offer')}</span>
            <span>{formatPrice(cart.bumpPrice)}</span>
          </div>
        )}
        {!dineIn && (
          <div className="summary__row">
            <span>{t('delivery')}</span>
            <span>{cart.deliveryFee ? formatPrice(cart.deliveryFee) : t('free')}</span>
          </div>
        )}
        {cart.coinsCost > 0 && (
          <div className="summary__row summary__row--save">
            <span>{t('with_coins')}</span>
            <span>
              🪙 {cart.coinsCost} {t('coin')}
            </span>
          </div>
        )}
        {cart.savings > 0 && (
          <div className="summary__row summary__row--save">
            <span>{t('you_saving')}</span>
            <span>−{formatPrice(cart.savings)}</span>
          </div>
        )}
        <div className="summary__total">
          <span>{t('total')}</span>
          <span>{formatPrice(cart.total)}</span>
        </div>
        {cart.paymentMethod === 'stars' && <div className="summary__stars">{t('or_stars', { stars: formatStars(cart.totalStars) })}</div>}
      </div>

      <h3 className="section-title">{t('pay_method')}</h3>
      <PaymentMethods methods={catalog.paymentMethods} value={cart.paymentMethod} onChange={cart.setPaymentMethod} totalStars={cart.totalStars} />

      <div className="cart-cta">
        <Button size="lg" block onClick={onCheckout}>
          {t('order_cta', { sum: formatPrice(cart.total) })}
        </Button>
        <div className="cart-cta__trust">{t('cart_trust')}</div>
      </div>
    </div>
  );
}

/* ---------- Buyurtma turi: yetkazish yoki zalda (avtomatik aniqlash bilan) ---------- */

function OrderTypePanel({ catalog, cart }: { catalog: Catalog; cart: ReturnType<typeof useCart> }) {
  const { t } = useT();
  const { webApp, haptic } = useTelegram();
  const [suggest, setSuggest] = useState<number | null>(null); // filial ichida turibdi — taklif
  const [detecting, setDetecting] = useState(false);
  const [note, setNote] = useState('');
  const checked = useRef(false);
  const branches = catalog.branches || [];
  const dineIn = cart.orderType === 'dinein';
  const branch = branches.find((b) => b.id === cart.dineBranchId) || null;

  const detect = async (silent: boolean) => {
    if (!silent) setDetecting(true);
    setNote('');
    try {
      const { lat, lng } = await getPosition(webApp);
      const r = await api.detectBranch(lat, lng);
      if (r.inside && r.branchId) {
        if (silent) setSuggest(r.branchId);
        else {
          cart.setDineIn(r.branchId);
          haptic.notify('success');
        }
      } else if (!silent) setNote(t('dine_not_inside'));
    } catch {
      if (!silent) setNote(t('geo_fail'));
    } finally {
      setDetecting(false);
    }
  };

  // Joylashuvga ruxsat allaqachon berilgan bo'lsa — jimgina tekshiramiz: mijoz filial ichidami?
  useEffect(() => {
    if (checked.current || dineIn || branches.length === 0) return;
    checked.current = true;
    locationGranted(webApp).then((granted) => {
      if (granted) void detect(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestBranch = branches.find((b) => b.id === suggest);

  return (
    <div className="order-type">
      <div className="segmented glass">
        <button className={cn(!dineIn && 'is-active')} onClick={() => cart.setOrderType('delivery')}>
          {t('type_delivery')}
        </button>
        <button
          className={cn(dineIn && 'is-active')}
          onClick={() => {
            if (!cart.dineBranchId && branches[0]) cart.setDineIn(branches[0].id);
            else cart.setOrderType('dinein');
          }}
        >
          {t('type_dinein')}
        </button>
      </div>

      {suggestBranch && !dineIn && (
        <div className="dine-suggest glass">
          <span>🍽 {t('dine_prompt', { branch: suggestBranch.name })}</span>
          <div>
            <Button
              onClick={() => {
                cart.setDineIn(suggestBranch.id);
                setSuggest(null);
                haptic.notify('success');
              }}
            >
              {t('dine_yes')}
            </Button>
            <Button variant="secondary" onClick={() => setSuggest(null)}>
              {t('dine_no')}
            </Button>
          </div>
        </div>
      )}

      {dineIn && (
        <div className="dine-box glass">
          {branches.length > 1 && (
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field__label">{t('dine_branch')}</span>
              <div className="admin-editor__cats">
                {branches.map((b) => (
                  <button key={b.id} className={cn('chip-tag', cart.dineBranchId === b.id && 'is-active')} onClick={() => cart.setDineIn(b.id)}>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {branches.length === 1 && branch && <b className="dine-box__branch">🏪 {branch.name}</b>}
          <Input
            label={t('dine_table')}
            inputMode="numeric"
            placeholder={branch ? `1–${branch.tables}` : '5'}
            value={cart.tableNo}
            onChange={(e) => cart.setTableNo(e.target.value)}
          />
          <button className="link-btn" onClick={() => detect(false)} disabled={detecting}>
            {detecting ? t('dine_detecting') : t('dine_detect')}
          </button>
          {note && <p className="muted">{note}</p>}
        </div>
      )}
    </div>
  );
}
