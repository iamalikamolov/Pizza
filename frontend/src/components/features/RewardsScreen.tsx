'use client';

// Bonuslar (coin) ekrani. Coin dasturi o'chirilgan bo'lsa — Aksiyalar (reklamalar ro'yxati)
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useTelegram } from '@/hooks/useTelegram';
import { api, type Banner, type Catalog, type CoinsInfo, type Product } from '@/lib/api';
import { cn, formatDate, formatPrice, thumb } from '@/lib/utils';
import { useT, type TKey } from '@/lib/i18n';

type Props = {
  catalog: Catalog;
  coinsCost: number; // savatchadagi coin bilan olinadiganlar
  rewardQtyOf: (id: string) => number;
  onAddReward: (p: Product) => void;
  onBannerAction: (b: Banner) => void;
  onGoCart: () => void;
  refreshKey: number;
};

const TYPE_TITLE: Record<string, TKey> = { earn: 'tx_earn', spend: 'tx_spend', refund: 'tx_refund', manual: 'tx_manual' };

export default function RewardsScreen({ catalog, coinsCost, rewardQtyOf, onAddReward, onBannerAction, onGoCart, refreshKey }: Props) {
  const { haptic } = useTelegram();
  const { t } = useT();
  const [info, setInfo] = useState<CoinsInfo | null>(null);
  const [error, setError] = useState('');
  const enabled = catalog.settings.coinsEnabled;

  useEffect(() => {
    if (!enabled) return;
    api
      .coins()
      .then(setInfo)
      .catch((e: Error) => setError(e.message));
  }, [enabled, refreshKey]);

  // ---------- Aksiyalar (coin o'chirilgan) ----------
  if (!enabled) {
    return (
      <div className="screen">
        <div className="screen__head">
          <h1 className="screen__title">{t('promos_title')}</h1>
          <p className="muted">{t('promos_sub')}</p>
        </div>
        <div className="promo-list">
          {catalog.banners.map((b) => (
            <button key={b.id} className={cn('promo-tile', `theme-${b.theme}`)} onClick={() => onBannerAction(b)}>
              <img src={thumb(b.image)} alt="" />
              <span className="promo-tile__body">
                {b.kicker && <small>{b.kicker}</small>}
                <b>{b.title}</b>
                {b.subtitle && <span>{b.subtitle}</span>}
              </span>
            </button>
          ))}
          {catalog.banners.length === 0 && <div className="empty-mini">{t('no_promos')}</div>}
        </div>
      </div>
    );
  }

  // ---------- Bonuslar ----------
  const balance = info?.balance ?? 0;
  const available = balance - coinsCost;
  const rewards = catalog.products.filter((p) => p.coinPrice);

  return (
    <div className="screen">
      <div className="screen__head">
        <h1 className="screen__title">{t('rewards_title')}</h1>
        <p className="muted">{t('rewards_sub')}</p>
      </div>

      <section className="coin-card">
        <div className="coin-card__glare" />
        <span className="coin-card__label">{t('balance')}</span>
        <div className="coin-card__balance">
          <span className="coin-card__coin">🪙</span>
          {info ? balance.toLocaleString('ru-RU').replace(/,/g, ' ') : '…'}
          <small>{t('coin')}</small>
        </div>
        {coinsCost > 0 && (
          <button className="coin-card__note" onClick={onGoCart}>
            {t('in_cart_coins', { n: coinsCost, left: Math.max(0, available) })}
          </button>
        )}
        <div className="coin-card__rule">
          {t('coin_rule', { n: info?.perThousand ?? catalog.settings.coinsPerThousand })}
        </div>
      </section>

      {error && <div className="form-error">⚠️ {error}</div>}

      <h3 className="section-title">{t('swap_title')}</h3>
      {rewards.length === 0 && <div className="empty-mini">{t('no_rewards')}</div>}
      <div className="reward-list">
        {rewards.map((p) => {
          const inCart = rewardQtyOf(p.id);
          const affordable = available >= (p.coinPrice || 0);
          const progress = Math.min(100, Math.round((Math.max(0, available) / (p.coinPrice || 1)) * 100));
          return (
            <div key={p.id} className="reward glass">
              <img src={thumb(p.image)} alt="" />
              <div className="reward__body">
                <b>{p.name}</b>
                <span className="reward__price">
                  🪙 {p.coinPrice} {t('coin')} <s>{formatPrice(p.price)}</s>
                </span>
                {!affordable && (
                  <span className="reward__progress">
                    <span style={{ width: `${progress}%` }} />
                  </span>
                )}
              </div>
              <button
                className={cn('reward__btn', !affordable && 'is-locked')}
                disabled={!affordable}
                onClick={() => {
                  haptic.notify('success');
                  onAddReward(p);
                }}
              >
                {affordable ? (inCart ? `+1 (${inCart})` : t('get')) : t('need_more', { n: (p.coinPrice || 0) - Math.max(0, available) })}
              </button>
            </div>
          );
        })}
      </div>

      <h3 className="section-title">{t('coin_history')}</h3>
      {info && info.history.length === 0 && <div className="empty-mini">{t('coin_history_empty')}</div>}
      <ul className="coin-history">
        {info?.history.map((h, i) => (
          <li key={i} className="glass">
            <span className={cn('coin-history__amount', h.amount > 0 ? 'is-plus' : 'is-minus')}>
              {h.amount > 0 ? '+' : ''}
              {h.amount}
            </span>
            <span className="coin-history__text">
              <b>{TYPE_TITLE[h.type] ? t(TYPE_TITLE[h.type]) : h.type}</b>
              <small>
                {h.note} · {formatDate(h.createdAt)}
              </small>
            </span>
            <Icon name="gift" size={18} />
          </li>
        ))}
      </ul>
    </div>
  );
}
