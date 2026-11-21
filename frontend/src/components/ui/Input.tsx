'use client';

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BaseProps = { label: string; error?: string; hint?: ReactNode };

export function Input({ label, error, hint, className, id, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = id || `in-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={cn('field', error && 'field--error', className)}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input id={inputId} className="field__input" {...rest} />
      {error ? <div className="field__error">{error}</div> : hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  );
}

export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const inputId = id || `ta-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={cn('field', error && 'field--error', className)}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <textarea id={inputId} className="field__input field__input--area" rows={2} {...rest} />
      {error ? <div className="field__error">{error}</div> : hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  );
}

export default Input;
