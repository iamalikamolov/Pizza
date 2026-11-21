'use client';

// "Yetkazish manzili" qatori + qidiruv tugmasi. Bosilganda saqlangan manzillardan tanlash oynasi ochiladi
import { useState } from 'react';
import { AddressEditor, AddressList, shortAddress } from '@/components/features/AddressBook';
import BottomSheet from '@/components/ui/BottomSheet';
import Icon from '@/components/ui/Icon';
import type { Address } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Props = {
  addresses: Address[];
  selected: Address | null;
  onSelect: (a: Address) => void;
  onChanged: () => void; // manzillar ro'yxati o'zgardi
  onSearch: () => void;
};

export default function AddressBar({ addresses, selected, onSelect, onChanged, onSearch }: Props) {
  const { t } = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editor, setEditor] = useState<{ initial: Address | null } | null>(null);

  const openBar = () => {
    if (addresses.length === 0) setEditor({ initial: null });
    else setPickerOpen(true);
  };

  return (
    <>
      <div className="address-bar glass">
        <button className="address-bar__main" onClick={openBar}>
          <span className="address-bar__pin">
            <Icon name="pin" size={20} />
          </span>
          <span className="address-bar__text">
            <small>{t('deliver_to')}</small>
            <b>
              <span>{selected ? shortAddress(selected) : t('add_address')}</span>
              <Icon name="chevron" size={16} strokeWidth={2.4} />
            </b>
          </span>
        </button>
        <button className="address-bar__search" onClick={onSearch} aria-label={t('search')}>
          <Icon name="search" size={20} />
        </button>
      </div>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('where_deliver')}>
        <AddressList
          addresses={addresses}
          selectedId={selected?.id}
          onSelect={(a) => {
            onSelect(a);
            setPickerOpen(false);
          }}
          onEdit={(a) => setEditor({ initial: a })}
          onAdd={() => setEditor({ initial: null })}
        />
      </BottomSheet>

      <AddressEditor
        open={Boolean(editor)}
        initial={editor?.initial || null}
        onClose={() => setEditor(null)}
        onSaved={(a) => {
          setEditor(null);
          onChanged();
          onSelect(a);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
