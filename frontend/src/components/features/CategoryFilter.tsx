'use client';

// Gorizontal skroll qilinadigan kategoriya teglari
import type { Category } from '@/lib/api';
import { useTelegram } from '@/hooks/useTelegram';
import { cn } from '@/lib/utils';

type Props = { categories: Category[]; active: string; onChange: (id: string) => void; counts: Record<string, number> };

export default function CategoryFilter({ categories, active, onChange, counts }: Props) {
  const { haptic } = useTelegram();
  return (
    <div className="chips" role="tablist" aria-label="Kategoriyalar">
      {categories.map((c) => (
        <button
          key={c.id}
          role="tab"
          aria-selected={active === c.id}
          className={cn('chip-tag', active === c.id && 'is-active')}
          onClick={(e) => {
            haptic.select();
            onChange(c.id);
            e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }}
        >
          <span>{c.emoji}</span> {c.title}
          <span className="chip-tag__count">{counts[c.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
