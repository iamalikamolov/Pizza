'use client';

// Order Stack — "Siz nimalarni olyapsiz"
import QuantityControl from '@/components/ui/QuantityControl';
import type { CartLine } from '@/hooks/useCart';
import { formatPrice, thumb } from '@/lib/utils';

type Props = {
  lines: CartLine[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
};

export default function CartList({ lines, onIncrement, onDecrement, onRemove }: Props) {
  return (
    <ul className="cart-list">
      {lines.map(({ product, qty, lineTotal, lineOld }) => (
        <li className="cart-item" key={product.id}>
          <img className="cart-item__img" src={thumb(product.image)} alt="" />
          <div className="cart-item__info">
            <div className="cart-item__name">{product.name}</div>
            <div className="cart-item__price">
              <span className="price__new">{formatPrice(lineTotal)}</span>
              {lineOld > lineTotal && <span className="price__old">{formatPrice(lineOld, false)}</span>}
            </div>
            <QuantityControl
              size="sm"
              value={qty}
              min={1}
              onIncrement={() => onIncrement(product.id)}
              onDecrement={() => onDecrement(product.id)}
            />
          </div>
          <button className="cart-item__remove" onClick={() => onRemove(product.id)} aria-label={`${product.name} ni oʻchirish`}>
            🗑
          </button>
        </li>
      ))}
    </ul>
  );
}
