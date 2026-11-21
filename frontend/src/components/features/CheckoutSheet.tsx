'use client';

// Buyurtmani rasmiylashtirish: ism-familiya, telefon va manzil (yetkazish) yoki filial/stol (zalda)
import { useEffect, useState } from 'react';
import { AddressEditor, AddressList } from '@/components/features/AddressBook';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useTelegram } from '@/hooks/useTelegram';
import type { Address, Branch, Me, OrderType, PaymentMethod } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatPhoneInput, formatPrice, formatStars, isValidPhone } from '@/lib/utils';

export type CheckoutForm = { fullName: string; phone: string; addressId?: number; comment: string };

type Props = {
  open: boolean;
  onClose: () => void;
  me: Me | null;
  orderType: OrderType;
  dineBranch: Branch | null;
  tableNo: string;
  addresses: Address[];
  selectedAddressId: number | null;
  onSelectAddress: (id: number) => void;
  onAddressesChanged: () => void;
  total: number;
  totalStars: number;
  coinsCost: number;
  payment: PaymentMethod | undefined;
  submitting: boolean;
  error: string;
  onSubmit: (form: CheckoutForm) => void;
};

export default function CheckoutSheet(props: Props) {
  const { open, me, addresses, selectedAddressId, payment, total, totalStars } = props;
  const { webApp, user, haptic } = useTelegram();
  const { t } = useT();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+998');
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; address?: string }>({});
  const [editor, setEditor] = useState<{ initial: Address | null } | null>(null);
  const dineIn = props.orderType === 'dinein';

  // Profildagi ma'lumotlar bilan to'ldirish
  useEffect(() => {
    if (!open) return;
    setFullName((v) => v || me?.fullName || [user?.first_name, user?.last_name].filter(Boolean).join(' '));
    setPhone((v) => (v.length > 4 ? v : me?.phone ? formatPhoneInput(me.phone) : '+998'));
    setErrors({});
  }, [open, me, user]);

  const selected = addresses.find((a) => a.id === selectedAddressId) || addresses.find((a) => a.isDefault) || addresses[0];

  const requestContact = () => {
    webApp?.requestContact?.((shared, response) => {
      const p = response?.responseUnsafe?.contact?.phone_number;
      if (shared && p) {
        haptic.notify('success');
        setPhone(formatPhoneInput(p));
      }
    });
  };

  const submit = () => {
    const next: typeof errors = {};
    if (fullName.trim().split(/\s+/).length < 2 || fullName.trim().length < 5) next.fullName = t('err_name');
    if (!isValidPhone(phone)) next.phone = t('err_phone');
    if (!dineIn && !selected) next.address = t('err_address');
    setErrors(next);
    if (Object.keys(next).length) {
      haptic.notify('error');
      return;
    }
    props.onSubmit({ fullName: fullName.trim(), phone: phone.replace(/\s/g, ''), addressId: dineIn ? undefined : selected?.id, comment: comment.trim() });
  };

  const ctaLabel =
    payment?.id === 'stars'
      ? t('pay_stars', { stars: formatStars(totalStars) })
      : payment?.id === 'provider'
        ? t('pay_sum', { sum: formatPrice(total) })
        : t('confirm_sum', { sum: formatPrice(total) });

  return (
    <>
      <BottomSheet
        open={open}
        onClose={props.onClose}
        title={t('confirm_title')}
        footer={
          <div className="sticky-cta sticky-cta--column">
            {props.error && <div className="form-error">⚠️ {props.error}</div>}
            <Button size="lg" block loading={props.submitting} onClick={submit}>
              {ctaLabel}
            </Button>
          </div>
        }
      >
        {dineIn ? (
          <div className="dine-box glass" style={{ marginTop: 4 }}>
            <b>{t('dine_qr', { branch: props.dineBranch?.name || '—', table: props.tableNo || '—' })}</b>
          </div>
        ) : (
          <>
            <h3 className="section-title" style={{ marginTop: 4 }}>
              {t('where_to')}
            </h3>
            <AddressList
              addresses={addresses}
              selectedId={selected?.id}
              onSelect={(a) => props.onSelectAddress(a.id)}
              onEdit={(a) => setEditor({ initial: a })}
              onAdd={() => setEditor({ initial: null })}
            />
            {errors.address && <div className="field__error">{errors.address}</div>}
          </>
        )}

        <h3 className="section-title">{t('receiver')}</h3>
        <Input
          label={t('full_name')}
          placeholder={t('full_name_ph')}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />
        <Input
          label={t('phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          error={errors.phone}
          hint={
            webApp?.requestContact && webApp.isVersionAtLeast('6.9') ? (
              <button type="button" className="link-btn" onClick={requestContact}>
                {t('tg_phone')}
              </button>
            ) : undefined
          }
        />
        <Textarea label={t('order_comment')} placeholder={t('order_comment_ph')} value={comment} onChange={(e) => setComment(e.target.value)} />

        <div className="checkout-summary">
          <span>{t('pay_method')}</span>
          <b>
            {payment?.emoji} {payment?.title}
          </b>
        </div>
        {props.coinsCost > 0 && (
          <div className="checkout-summary">
            <span>{t('with_coins')}</span>
            <b>
              🪙 {props.coinsCost} {t('coin')}
            </b>
          </div>
        )}
      </BottomSheet>

      <AddressEditor
        open={Boolean(editor)}
        initial={editor?.initial || null}
        onClose={() => setEditor(null)}
        onSaved={(a) => {
          setEditor(null);
          props.onAddressesChanged();
          props.onSelectAddress(a.id);
        }}
      />
    </>
  );
}
