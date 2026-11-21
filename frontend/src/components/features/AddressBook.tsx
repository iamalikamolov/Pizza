'use client';

// Manzillar: avtomatik joylashuv aniqlash, tahrirlash oynasi va ro'yxat
import { useEffect, useRef, useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Input, Textarea } from '@/components/ui/Input';
import { useTelegram, type TelegramWebApp } from '@/hooks/useTelegram';
import { api, type Address, type AddressInput } from '@/lib/api';
import { translate, currentLang, useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Bazada saqlanadigan qiymat (o'zbekcha) -> ko'rinadigan nom
const LABELS: Array<{ id: string; icon: string; key: TKey }> = [
  { id: 'Uy', icon: '🏠', key: 'lbl_home' },
  { id: 'Ish', icon: '💼', key: 'lbl_work' },
  { id: 'Boshqa', icon: '📍', key: 'lbl_other' },
];

export function labelIcon(label: string) {
  return LABELS.find((l) => l.id === label)?.icon || '📍';
}

function labelText(label: string) {
  const l = LABELS.find((x) => x.id === label);
  return l ? translate(currentLang(), l.key) : label;
}

export function shortAddress(a: Address) {
  const lang = currentLang();
  const extra = [a.apartment && translate(lang, 'apt_short', { n: a.apartment }), a.entrance && translate(lang, 'ent_short', { n: a.entrance })]
    .filter(Boolean)
    .join(', ');
  return extra ? `${a.address}, ${extra}` : a.address;
}

/** Joylashuvni olish: Telegram LocationManager (8.0+) yoki brauzer geolokatsiyasi */
export function getPosition(webApp: TelegramWebApp | null): Promise<{ lat: number; lng: number }> {
  const lm = webApp?.LocationManager;
  if (lm && webApp?.isVersionAtLeast('8.0')) {
    return new Promise((resolve, reject) => {
      const ask = () => {
        if (!lm.isLocationAvailable) return reject(new Error('unavailable'));
        lm.getLocation((data) => (data ? resolve({ lat: data.latitude, lng: data.longitude }) : reject(new Error('denied'))));
      };
      if (lm.isInited) ask();
      else lm.init(ask);
    });
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unavailable'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

/** Joylashuvga ruxsat oldindan berilganmi (so'rov oynasini ochmasdan tekshiradi) */
export function locationGranted(webApp: TelegramWebApp | null): Promise<boolean> {
  const lm = webApp?.LocationManager;
  if (lm && webApp?.isVersionAtLeast('8.0')) {
    return new Promise((resolve) => {
      const check = () => resolve(Boolean(lm.isLocationAvailable && lm.isAccessGranted));
      if (lm.isInited) check();
      else lm.init(check);
    });
  }
  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    return navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => p.state === 'granted')
      .catch(() => false);
  }
  return Promise.resolve(false);
}

const EMPTY: AddressInput = { label: 'Uy', address: '', apartment: '', entrance: '', floor: '', note: '', lat: null, lng: null };

type GeoState = 'idle' | 'locating' | 'done' | 'error';

type EditorProps = {
  open: boolean;
  initial: Address | null; // null — yangi manzil
  onClose: () => void;
  onSaved: (a: Address) => void;
};

export function AddressEditor({ open, initial, onClose, onSaved }: EditorProps) {
  const { webApp, haptic } = useTelegram();
  const { t } = useT();
  const [form, setForm] = useState<AddressInput>(EMPTY);
  const [isDefault, setIsDefault] = useState(false);
  const [geo, setGeo] = useState<GeoState>('idle');
  const [geoMsg, setGeoMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const detailsRef = useRef<HTMLDivElement>(null);

  const locate = async () => {
    setGeo('locating');
    setGeoMsg(t('geo_progress'));
    try {
      const { lat, lng } = await getPosition(webApp);
      setForm((f) => ({ ...f, lat, lng }));
      try {
        const r = await api.geocode(lat, lng);
        setForm((f) => ({ ...f, address: r.address || f.address, lat, lng }));
        setGeoMsg(t('geo_ok'));
      } catch {
        setGeoMsg(t('geo_partial'));
      }
      setGeo('done');
      haptic.notify('success');
      setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    } catch {
      setGeo('error');
      setGeoMsg(t('geo_fail'));
    }
  };

  useEffect(() => {
    if (!open) return;
    setError('');
    if (initial) {
      setForm({ ...initial });
      setIsDefault(initial.isDefault);
      setGeo(initial.lat !== null ? 'done' : 'idle');
      setGeoMsg('');
    } else {
      setForm(EMPTY);
      setIsDefault(false);
      void locate(); // yangi manzil — avtomatik aniqlaymiz
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (key: keyof AddressInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    if (form.address.trim().length < 5) {
      setError(t('addr_short_err'));
      haptic.notify('error');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, isDefault };
      const saved = initial ? await api.updateAddress(initial.id, payload) : await api.createAddress(payload);
      haptic.notify('success');
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={initial ? t('addr_edit') : t('addr_new')}
      footer={
        <div className="sticky-cta sticky-cta--column">
          {error && <div className="form-error">⚠️ {error}</div>}
          <Button size="lg" block loading={saving} onClick={save}>
            {t('addr_save')}
          </Button>
        </div>
      }
    >
      <button className={cn('geo-card', `geo-card--${geo}`)} onClick={locate} disabled={geo === 'locating'}>
        <span className="geo-card__icon">{geo === 'locating' ? <span className="spinner spinner--dark" /> : <Icon name="locate" size={22} />}</span>
        <span className="geo-card__text">
          <b>{geo === 'done' ? t('geo_done') : geo === 'locating' ? t('geo_locating') : t('geo_detect')}</b>
          <small>{geoMsg || t('geo_hint')}</small>
        </span>
      </button>
      {form.lat !== null && form.lng !== null && (
        <a className="link-btn geo-map" href={`https://maps.google.com/?q=${form.lat},${form.lng}`} target="_blank" rel="noreferrer">
          {t('map_check')}
        </a>
      )}

      <div className="field">
        <span className="field__label">{t('addr_name')}</span>
        <div className="admin-editor__cats">
          {LABELS.map((l) => (
            <button key={l.id} type="button" className={cn('chip-tag', form.label === l.id && 'is-active')} onClick={() => setForm((f) => ({ ...f, label: l.id }))}>
              {l.icon} {t(l.key)}
            </button>
          ))}
        </div>
      </div>

      <Textarea label={t('addr_field')} value={form.address} onChange={set('address')} placeholder={t('addr_field_ph')} />

      <div ref={detailsRef} className="address-grid">
        <Input label={t('apartment')} inputMode="numeric" value={form.apartment} onChange={set('apartment')} placeholder="45" />
        <Input label={t('entrance')} inputMode="numeric" value={form.entrance} onChange={set('entrance')} placeholder="2" />
        <Input label={t('floor')} inputMode="numeric" value={form.floor} onChange={set('floor')} placeholder="5" />
      </div>
      <Textarea label={t('landmark')} value={form.note} onChange={set('note')} placeholder={t('landmark_ph')} />

      <label className="check-row">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        <span>{t('make_default')}</span>
      </label>
    </BottomSheet>
  );
}

type ListProps = {
  addresses: Address[];
  selectedId?: number | null;
  onSelect?: (a: Address) => void; // tanlash rejimi
  onEdit: (a: Address) => void;
  onDelete?: (a: Address) => void;
  onAdd: () => void;
};

export function AddressList({ addresses, selectedId, onSelect, onEdit, onDelete, onAdd }: ListProps) {
  const { t } = useT();
  return (
    <div className="address-list">
      {addresses.map((a) => {
        const selected = onSelect ? selectedId === a.id : a.isDefault;
        return (
          <div key={a.id} className={cn('address-item glass', selected && 'is-selected')}>
            <button className="address-item__main" onClick={() => (onSelect ? onSelect(a) : onEdit(a))}>
              <span className="address-item__icon">{labelIcon(a.label)}</span>
              <span className="address-item__text">
                <b>
                  {labelText(a.label)} {a.isDefault && <em>{t('default_tag')}</em>}
                </b>
                <small>{shortAddress(a)}</small>
              </span>
              {onSelect && <span className="pay__radio address-item__radio" />}
            </button>
            <button className="address-item__btn" onClick={() => onEdit(a)} aria-label={t('edit')}>
              <Icon name="edit" size={18} />
            </button>
            {onDelete && (
              <button className="address-item__btn address-item__btn--danger" onClick={() => onDelete(a)} aria-label={t('delete')}>
                <Icon name="trash" size={18} />
              </button>
            )}
          </div>
        );
      })}
      <button className="address-add" onClick={onAdd}>
        <Icon name="plus" size={18} strokeWidth={2.4} /> {t('add_new_address')}
      </button>
    </div>
  );
}

export { labelText };
