// Zustand: savatdagi ma'lumotlarni saqlash (localStorage ga persist qilinadi)
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OrderType, PaymentMethodId } from '@/lib/api';

const MAX_QTY = 20;

type CartState = {
  items: Record<string, number>; // productId -> qty
  rewards: Record<string, number>; // coinga olinadiganlar: productId -> qty
  addressId: number | null; // tanlangan yetkazish manzili
  orderType: OrderType; // yetkazish yoki zalda
  dineBranchId: number | null;
  tableNo: string;
  bumpAdded: boolean;
  paymentMethod: PaymentMethodId;

  add: (productId: string, qty?: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setBump: (value: boolean) => void;
  setPaymentMethod: (method: PaymentMethodId) => void;
  addReward: (productId: string) => void;
  removeReward: (productId: string) => void;
  setAddressId: (id: number | null) => void;
  setDineIn: (branchId: number | null, tableNo?: string) => void;
  setOrderType: (type: OrderType) => void;
  setTableNo: (n: string) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: {},
      rewards: {},
      addressId: null,
      orderType: 'delivery',
      dineBranchId: null,
      tableNo: '',
      bumpAdded: false,
      paymentMethod: 'cash',

      add: (productId, qty = 1) =>
        set((s) => ({
          items: { ...s.items, [productId]: Math.min((s.items[productId] || 0) + qty, MAX_QTY) },
        })),

      increment: (productId) =>
        set((s) => ({
          items: { ...s.items, [productId]: Math.min((s.items[productId] || 0) + 1, MAX_QTY) },
        })),

      decrement: (productId) =>
        set((s) => {
          const next = (s.items[productId] || 0) - 1;
          const items = { ...s.items };
          if (next <= 0) delete items[productId];
          else items[productId] = next;
          return { items };
        }),

      remove: (productId) =>
        set((s) => {
          const items = { ...s.items };
          delete items[productId];
          return { items };
        }),

      clear: () => set({ items: {}, rewards: {}, bumpAdded: false }),
      addReward: (productId) =>
        set((s) => ({ rewards: { ...s.rewards, [productId]: Math.min((s.rewards[productId] || 0) + 1, MAX_QTY) } })),
      removeReward: (productId) =>
        set((s) => {
          const rewards = { ...s.rewards };
          delete rewards[productId];
          return { rewards };
        }),
      setAddressId: (id) => set({ addressId: id }),
      setDineIn: (branchId, tableNo) =>
        set((s) => ({ orderType: 'dinein', dineBranchId: branchId, tableNo: tableNo ?? s.tableNo })),
      setOrderType: (type) => set({ orderType: type }),
      setTableNo: (n) => set({ tableNo: n.replace(/\D/g, '').slice(0, 3) }),
      setBump: (value) => set({ bumpAdded: value }),
      setPaymentMethod: (method) => set({ paymentMethod: method }),
    }),
    {
      name: 'pizza-cart',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (state) =>
        ({ rewards: {}, addressId: null, orderType: 'delivery', dineBranchId: null, tableNo: '', ...(state as object) }) as CartState,
    }
  )
);
