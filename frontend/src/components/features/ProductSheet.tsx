'use client';

// 4-bosqich: mahsulot Bottom Sheet — katta rasm, tarkib, kafolatlar va sticky CTA
import { useEffect, useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import QuantityControl from '@/components/ui/QuantityControl';
import type { Product } from '@/lib/api';
import { discountPercent, formatPrice } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = {
  product: Product | null;
  onClose: () => void;
  onAdd: (product: Product, qty: number) => void;
};

const GUARANTEES = [
  { icon: '♨️', title: 'g_hot', text: 'g_hot_s' },
  { icon: '⏱', title: 'g_time', text: 'g_time_s' },
  { icon: '💬', title: 'g_help', text: 'g_help_s' },
] as const;

export default function ProductSheet({ product, onClose, onAdd }: Props) {
  const { t } = useT();
  const [qty, setQty] = useState(1);
  const [shown, setShown] = useState<Product | null>(product);

  useEffect(() => {
    if (product) {
      setShown(product);
      setQty(1);
    }
  }, [product]);

  const p = product || shown;
  if (!p) return null;
  const discount = discountPercent(p.oldPrice, p.price);

  return (
    <BottomSheet
      open={Boolean(product)}
      onClose={onClose}
      title={p.name}
      className="product-sheet"
      footer={
        <Button size="lg" block onClick={() => onAdd(p, qty)}>
          {t('add_cart_cta', { sum: formatPrice(p.price * qty) })}
        </Button>
      }
    >
      <div className="product-sheet__visual">
        <img className="product-sheet__img" src={p.image} alt={p.name} />
        {p.badge && <span className="card__badge">{p.badge}</span>}
        {discount > 0 && <span className="product-sheet__discount">−{discount}%</span>}
      </div>

      <div className="product-sheet__meta">
        <span>⭐️ {p.rating} ({p.reviews})</span>
        <span>📏 {p.size}</span>
        <span>⚖️ {p.weight}</span>
      </div>

      <div className="product-sheet__buy">
        <div className="product-sheet__price">
          {p.oldPrice > p.price && <span className="price__old">{formatPrice(p.oldPrice)}</span>}
          <span className="price__new price__new--lg">{formatPrice(p.price)}</span>
          {p.oldPrice > p.price && <span className="save-pill">{t('you_save', { sum: formatPrice(p.oldPrice - p.price) })}</span>}
        </div>
        <QuantityControl
          value={qty}
          min={1}
          onIncrement={() => setQty((q) => Math.min(20, q + 1))}
          onDecrement={() => setQty((q) => Math.max(1, q - 1))}
        />
      </div>

      <p className="product-sheet__desc">{p.description}</p>

      <h3 className="section-title">{t('inside')}</h3>
      <ul className="bullets">
        {p.ingredients.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>

      <h3 className="section-title">{t('safe_order')}</h3>
      <div className="guarantees">
        {GUARANTEES.map((g) => (
          <div className="guarantee" key={g.title}>
            <span className="guarantee__icon">{g.icon}</span>
            <span className="guarantee__title">{t(g.title)}</span>
            <span className="guarantee__text">{t(g.text)}</span>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
