'use client';

import { cn } from '@/lib/utils';

type Props = { checked: boolean; onChange: (value: boolean) => void; label?: string };

export default function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn('switch', checked && 'switch--on')}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="switch__thumb" />
    </button>
  );
}
