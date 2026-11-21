'use client';

// Qidiruv qatori + filtr tugmasi
import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  onFocusRedirect?: () => void; // bosh sahifada: bosilganda katalogga o'tadi
  onFilter?: () => void;
  autoFocus?: boolean;
  filterActive?: boolean;
};

export default function SearchBar({ value = '', onChange, onFocusRedirect, onFilter, autoFocus, filterActive }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const { t } = useT();

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <div className="search">
      <label className="search__field glass">
        <Icon name="search" size={20} />
        <input
          ref={ref}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder={t('search_ph')}
          value={value}
          readOnly={Boolean(onFocusRedirect)}
          onFocus={onFocusRedirect}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {value && onChange && (
          <button type="button" className="search__clear" onClick={() => onChange('')} aria-label={t('close')}>
            <Icon name="close" size={16} />
          </button>
        )}
      </label>
      <button
        type="button"
        className={filterActive ? 'search__filter is-active' : 'search__filter'}
        onClick={onFilter || onFocusRedirect}
        aria-label={t('sort')}
      >
        <Icon name="filter" size={20} />
      </button>
    </div>
  );
}
