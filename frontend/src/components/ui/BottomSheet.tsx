'use client';

// Pastdan tepaga qalqib chiquvchi oyna (Bottom Sheet) — pastga tortib yopish mumkin
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { bindBackButton, useTelegram } from '@/hooks/useTelegram';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode; // ekran pastiga yopishgan (sticky) CTA
  title?: string;
  className?: string;
};

const CLOSE_THRESHOLD = 110;

export default function BottomSheet({ open, onClose, children, footer, title, className }: Props) {
  const { webApp } = useTelegram();
  const { t } = useT();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ochilish / yopilish animatsiyasi
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 280);
    return () => clearTimeout(t);
  }, [open]);

  // Telegram "Orqaga" tugmasi va Escape
  useEffect(() => {
    if (!open) return;
    const close = () => onCloseRef.current();
    const unbind = bindBackButton(webApp, close);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      unbind();
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [open, webApp]);

  const onTouchStart = (e: TouchEvent) => {
    // kontent tepaga skroll qilinmagan bo'lsagina tortib yopishga ruxsat
    if ((bodyRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    setDragY(delta > 0 ? delta : 0);
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (dragY > CLOSE_THRESHOLD) onCloseRef.current();
    setDragY(0);
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className={cn('sheet-root', visible && 'is-open')} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-overlay" onClick={onClose} />
      <div
        className={cn('sheet', className)}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="sheet__handle" />
        <button className="sheet__close" onClick={onClose} aria-label={t('close')}>
          ✕
        </button>
        {title && <h2 className="sheet__title">{title}</h2>}
        <div className="sheet__body" ref={bodyRef}>
          {children}
        </div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
