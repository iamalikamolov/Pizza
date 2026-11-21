'use client';

// Profil: rasm, til, shaxsiy ma'lumotlar, manzillar, coinlar, buyurtmalar tarixi va xodimlar paneli
import { useEffect, useRef, useState } from 'react';
import { AddressEditor, AddressList } from '@/components/features/AddressBook';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTelegram } from '@/hooks/useTelegram';
import { api, type Address, type Me, type OrderHistoryItem } from '@/lib/api';
import { LANGS, useT, type Lang, type TKey } from '@/lib/i18n';
import { WALLPAPERS, useThemeStore } from '@/store/themeStore';
import { cn, formatDate, formatPhoneInput, formatPrice, isValidPhone } from '@/lib/utils';

type Props = {
  me: Me | null;
  addresses: Address[];
  supportUsername: string;
  onReorder: (items: OrderHistoryItem['items']) => void;
  onOpenAdmin: () => void;
  onOpenRewards: () => void;
  onMeChanged: () => void;
  onAddressesChanged: () => void;
  onLangChange: (lang: Lang) => void;
};

/** Rasmni telefonning o'zida kvadrat qilib kesib, 320px JPEG ga kichraytiradi */
function resizeImage(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

export default function Profile(props: Props) {
  const { me, addresses } = props;
  const { user, webApp, haptic } = useTelegram();
  const { t, lang } = useT();
  const [orders, setOrders] = useState<OrderHistoryItem[] | null>(null);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+998');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const [editor, setEditor] = useState<{ initial: Address | null } | null>(null);
  const [photoState, setPhotoState] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const wallpaper = useThemeStore((s) => s.wallpaper);
  const setWallpaper = useThemeStore((s) => s.setWallpaper);

  useEffect(() => {
    api
      .getOrders()
      .then(setOrders)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setFullName(me?.fullName || [user?.first_name, user?.last_name].filter(Boolean).join(' '));
    setPhone(me?.phone ? formatPhoneInput(me.phone) : '+998');
  }, [me, user]);

  const name = me?.fullName || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || t('guest');
  const dirty = fullName.trim() !== (me?.fullName || '') || phone.replace(/\s/g, '') !== (me?.phone || '');
  const photo = me?.avatar || user?.photo_url;

  const requestContact = () => {
    webApp?.requestContact?.((shared, response) => {
      const p = response?.responseUnsafe?.contact?.phone_number;
      if (shared && p) setPhone(formatPhoneInput(p));
    });
  };

  const onPhotoPicked = async (file: File | undefined) => {
    if (!file) return;
    setPhotoState('saving');
    try {
      const dataUrl = await resizeImage(file);
      await api.setAvatar(dataUrl);
      haptic.notify('success');
      setPhotoState('saved');
      props.onMeChanged();
    } catch {
      haptic.notify('error');
      setPhotoState('error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setPhotoState(''), 2200);
    }
  };

  const resetPhoto = async () => {
    await api.setAvatar(null).catch(() => undefined);
    props.onMeChanged();
  };

  const saveProfile = async () => {
    setFormError('');
    if (fullName.trim().split(/\s+/).length < 2) return setFormError(t('err_name'));
    if (!isValidPhone(phone)) return setFormError(t('err_phone'));
    setSaving(true);
    try {
      await api.updateMe({ fullName: fullName.trim(), phone: phone.replace(/\s/g, '') });
      haptic.notify('success');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      props.onMeChanged();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (a: Address) => {
    const ok = await new Promise<boolean>((resolve) =>
      webApp ? webApp.showConfirm(t('delete_addr_q', { label: a.label }), resolve) : resolve(window.confirm(t('delete_addr_q', { label: a.label })))
    );
    if (!ok) return;
    await api.deleteAddress(a.id).catch(() => undefined);
    props.onAddressesChanged();
  };

  return (
    <div className="screen">
      <div className="profile-card">
        <button className="profile-card__avatar profile-card__avatar--edit" onClick={() => fileRef.current?.click()} aria-label={t('photo_change')}>
          {photo ? <img src={photo} alt="" /> : <span>{name.charAt(0).toUpperCase()}</span>}
          <span className="profile-card__cam">📷</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhotoPicked(e.target.files?.[0])} />
        <div className="profile-card__info">
          <div className="profile-card__name">{name}</div>
          <div className="profile-card__meta">
            {me?.phone ? formatPhoneInput(me.phone) : t('phone_missing')}
            {user?.username ? ` · @${user.username}` : ''}
          </div>
          {me && me.role !== 'customer' && <span className="profile-card__role">{me.roleTitle}</span>}
        </div>
      </div>
      <div className="photo-actions">
        <button className="link-btn" onClick={() => fileRef.current?.click()}>
          📷 {photoState === 'saving' ? t('photo_saving') : photoState === 'saved' ? t('photo_saved') : photoState === 'error' ? t('photo_err') : t('photo_change')}
        </button>
        {me?.avatar && (
          <button className="link-btn link-btn--muted" onClick={resetPhoto}>
            {t('photo_reset')}
          </button>
        )}
      </div>

      {me && me.role !== 'customer' && (
        <button className="admin-entry" onClick={props.onOpenAdmin}>
          <span className="admin-entry__icon">🛠</span>
          <span className="admin-entry__text">
            <b>{me.role === 'owner' ? t('admin_panel') : t('staff_panel')}</b>
            <small>{me.role === 'courier' ? t('panel_courier') : me.role === 'cook' ? t('panel_cook') : t('panel_manage')}</small>
          </span>
          <span className="admin-entry__arrow">→</span>
        </button>
      )}

      <div className="stats stats--compact">
        <div className="stat">
          <div className="stat__value">{me?.ordersCount ?? 0}</div>
          <div className="stat__label">{t('orders_n')}</div>
        </div>
        {me?.coinsEnabled ? (
          <button className="stat stat--btn" onClick={props.onOpenRewards}>
            <div className="stat__value">🪙 {me.coins}</div>
            <div className="stat__label">{t('coins_link')}</div>
          </button>
        ) : (
          <div className="stat">
            <div className="stat__value">{addresses.length}</div>
            <div className="stat__label">{t('addresses_n')}</div>
          </div>
        )}
      </div>

      <h3 className="section-title">🌐 {t('language')}</h3>
      <div className="lang-switch glass">
        {LANGS.map((l) => (
          <button
            key={l.id}
            className={cn('lang-switch__item', lang === l.id && 'is-active')}
            onClick={() => {
              haptic.select();
              props.onLangChange(l.id);
            }}
          >
            <span>{l.flag}</span>
            {l.label}
          </button>
        ))}
      </div>

      <h3 className="section-title">✨ {t('wp_title')}</h3>
      <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>
        {t('wp_hint')}
      </p>
      <div className="wp-grid">
        {WALLPAPERS.map((w) => (
          <button
            key={w.id}
            className={cn('wp-item glass', wallpaper === w.id && 'is-active')}
            onClick={() => {
              haptic.select();
              setWallpaper(w.id);
            }}
          >
            <span>{w.emoji}</span>
            {t(`wp_${w.id}` as TKey)}
          </button>
        ))}
      </div>

      <h3 className="section-title">{t('personal')}</h3>
      <div className="profile-form glass">
        <Input label={t('full_name')} value={fullName} autoComplete="name" onChange={(e) => setFullName(e.target.value)} placeholder={t('full_name_ph')} />
        <Input
          label={t('phone')}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          hint={
            webApp?.requestContact && webApp.isVersionAtLeast('6.9') ? (
              <button type="button" className="link-btn" onClick={requestContact}>
                {t('tg_phone_get')}
              </button>
            ) : undefined
          }
        />
        {formError && (
          <div className="form-error" style={{ marginTop: 10 }}>
            ⚠️ {formError}
          </div>
        )}
        <Button block loading={saving} disabled={!dirty && !saved} onClick={saveProfile} className="profile-form__save">
          {saved ? t('saved') : t('save')}
        </Button>
      </div>

      <h3 className="section-title">{t('my_addresses')}</h3>
      <AddressList addresses={addresses} onEdit={(a) => setEditor({ initial: a })} onDelete={deleteAddress} onAdd={() => setEditor({ initial: null })} />

      <h3 className="section-title">{t('history')}</h3>
      {error && <div className="empty-mini">⚠️ {error}</div>}
      {!error && orders === null && <div className="skeleton skeleton--row" />}
      {orders && orders.length === 0 && <div className="empty-mini">{t('no_orders')}</div>}
      {orders && orders.length > 0 && (
        <ul className="history">
          {orders.map((o) => (
            <li className="history__item" key={o.id}>
              <div className="history__top">
                <b>
                  #{o.id} {o.orderType === 'dinein' ? '🍽' : '🛵'}
                </b>
                <span className="history__status">{o.statusTitle}</span>
              </div>
              <div className="history__items">{o.items.map((i) => `${i.reward ? '🎁 ' : ''}${i.name} × ${i.qty}`).join(', ')}</div>
              <div className="history__bottom">
                <span className="muted">
                  {formatDate(o.createdAt)}
                  {o.coinsEarned ? ` · +${o.coinsEarned} ${t('coin')}` : ''}
                </span>
                <b>{formatPrice(o.total)}</b>
              </div>
              <button className="link-btn" onClick={() => props.onReorder(o.items.filter((i) => !i.reward))}>
                {t('repeat')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section-title">{t('help')}</h3>
      <div className="support">
        <span className="support__icon">💬</span>
        <div className="support__text">
          <b>{t('help_center')}</b>
          <span className="muted">{t('help_text')}</span>
        </div>
      </div>
      {props.supportUsername && (
        <Button
          variant="secondary"
          block
          onClick={() => (webApp ? webApp.openTelegramLink(`https://t.me/${props.supportUsername}`) : window.open(`https://t.me/${props.supportUsername}`))}
        >
          {t('write_operator')}
        </Button>
      )}

      <AddressEditor
        open={Boolean(editor)}
        initial={editor?.initial || null}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          props.onAddressesChanged();
        }}
      />
    </div>
  );
}
