'use client';

// Mahsulot kartochkasi: rasm, nom, chizilgan eski narx, qizil yangi narx va ➕ tugma
import Icon from '@/components/ui/Icon';
import type { Product } from '@/lib/api';
import { cn, discountPercent, formatPrice, thumb } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = {
  product: Product;
  qty: number;
  onOpen: () => void;
  onAdd: () => void;
};

export default function ProductCard({ product, qty, onOpen, onAdd }: Props) {
  const { t } = useT();
  const discount = discountPercent(product.oldPrice, product.price);
  return (
    <article className="card glass" onClick={onOpen}>
      <div className="card__media">
        <img className="card__img" src={thumb(product.image)} alt={product.name} loading="lazy" />
        {product.badge && <span className="card__badge">{product.badge}</span>}
        {discount > 0 && <span className="card__discount">−{discount}%</span>}
      </div>
      <div className="card__body">
        <h3 className="card__name">{product.name}</h3>
        <p className="card__desc">{product.description}</p>
        <div className="card__rating">
          <Icon name="star" size={13} filled stroke="none" /> {product.rating} <span>({product.reviews})</span>
        </div>
        <div className="card__bottom">
          <div className="price">
            {product.oldPrice > product.price && <span className="price__old">{formatPrice(product.oldPrice, false)}</span>}
            <span className="price__new">{formatPrice(product.price)}</span>
          </div>
          <button
            className={cn('card__add', qty > 0 && 'has-qty')}
            aria-label={t('add_to_cart_aria', { name: product.name })}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            {qty > 0 ? (
              <span key={qty} className="card__add-count">
                {qty}
              </span>
            ) : (
              <Icon name="plus" size={18} strokeWidth={2.6} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
