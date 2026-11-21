'use client';

// Savat logikasini boshqarish: store + katalog -> qatorlar va hisob-kitob
import { useMemo } from 'react';
import { useCartStore } from '@/store/cartStore';
import type { Catalog, Product } from '@/lib/api';

export type CartLine = { product: Product; qty: number; lineTotal: number; lineOld: number };
export type RewardLine = { product: Product; qty: number; coins: number };

export function useCart(catalog: Catalog | null) {
  const items = useCartStore((s) => s.items);
  const bumpAdded = useCartStore((s) => s.bumpAdded);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const rewards = useCartStore((s) => s.rewards);
  const addressId = useCartStore((s) => s.addressId);
  const orderType = useCartStore((s) => s.orderType);
  const dineBranchId = useCartStore((s) => s.dineBranchId);
  const tableNo = useCartStore((s) => s.tableNo);
  const actions = useCartStore.getState();

  const summary = useMemo(() => {
    const productMap = new Map((catalog?.products || []).map((p) => [p.id, p]));

    const lines: CartLine[] = Object.entries(items)
      .map(([id, qty]) => {
        const product = productMap.get(id);
        if (!product) return null;
        return { product, qty, lineTotal: product.price * qty, lineOld: (product.oldPrice || product.price) * qty };
      })
      .filter((l): l is CartLine => l !== null);

    const coinsEnabled = Boolean(catalog?.settings?.coinsEnabled);
    const rewardLines: RewardLine[] = coinsEnabled
      ? Object.entries(rewards)
          .map(([id, qty]) => {
            const product = productMap.get(id);
            if (!product || !product.coinPrice) return null;
            return { product, qty, coins: product.coinPrice * qty };
          })
          .filter((l): l is RewardLine => l !== null)
      : [];
    const coinsCost = rewardLines.reduce((s, l) => s + l.coins, 0);
    const rewardCount = rewardLines.reduce((s, l) => s + l.qty, 0);

    const paidCount = lines.reduce((s, l) => s + l.qty, 0);
    const count = paidCount + rewardCount;
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const oldSubtotal = lines.reduce((s, l) => s + l.lineOld, 0);

    const bump = catalog?.orderBump;
    const bumpPrice = bumpAdded && bump && paidCount > 0 ? bump.price : 0;
    const bumpSavings = bumpAdded && bump && paidCount > 0 ? bump.oldPrice - bump.price : 0;

    const delivery = catalog?.delivery || { fee: 0, freeFrom: 0 };
    const dineIn = orderType === 'dinein';
    const deliveryFee = dineIn || count === 0 || subtotal >= delivery.freeFrom ? 0 : delivery.fee;
    const leftForFreeDelivery = dineIn || count === 0 ? 0 : Math.max(0, delivery.freeFrom - subtotal);

    const total = subtotal + bumpPrice + deliveryFee;
    const totalStars = catalog ? Math.max(1, Math.ceil(total / catalog.starsRate)) : 0;

    return {
      lines,
      rewardLines,
      coinsCost,
      paidCount,
      count,
      subtotal,
      savings: oldSubtotal - subtotal + bumpSavings,
      bumpPrice,
      deliveryFee,
      leftForFreeDelivery,
      total,
      totalStars,
    };
  }, [items, rewards, bumpAdded, catalog, orderType]);

  return {
    ...summary,
    items,
    bumpAdded,
    paymentMethod,
    addressId,
    orderType,
    dineBranchId,
    tableNo,
    setDineIn: actions.setDineIn,
    setOrderType: actions.setOrderType,
    setTableNo: actions.setTableNo,
    qtyOf: (productId: string) => items[productId] || 0,
    rewardQtyOf: (productId: string) => rewards[productId] || 0,
    addReward: actions.addReward,
    removeReward: actions.removeReward,
    setAddressId: actions.setAddressId,
    add: actions.add,
    increment: actions.increment,
    decrement: actions.decrement,
    remove: actions.remove,
    clear: actions.clear,
    setBump: actions.setBump,
    setPaymentMethod: actions.setPaymentMethod,
  };
}
