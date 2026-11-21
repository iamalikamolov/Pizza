'use client';

import { cn } from '@/lib/utils';

type Props = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
};

export default function QuantityControl({ value, onIncrement, onDecrement, min = 0, max = 20, size = 'md' }: Props) {
  return (
    <div className={cn('qty', `qty--${size}`)} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="qty__btn" onClick={onDecrement} disabled={value <= min} aria-label="Kamaytirish">
        −
      </button>
      <span className="qty__value" aria-live="polite">
        {value}
      </span>
      <button type="button" className="qty__btn" onClick={onIncrement} disabled={value >= max} aria-label="Koʻpaytirish">
        +
      </button>
    </div>
  );
}
