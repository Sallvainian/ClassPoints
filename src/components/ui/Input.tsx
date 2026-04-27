import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-muted"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-[10px] border border-hairline bg-surface-2 px-3 py-2.5 text-sm text-ink-strong placeholder:text-ink-muted/70 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-colors ${
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
