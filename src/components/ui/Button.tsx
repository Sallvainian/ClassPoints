import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-accent-400/40 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_rgba(168,70,45,0.25)]',
  secondary:
    'bg-surface-2 text-ink-strong border border-hairline hover:border-hairline-strong hover:bg-surface-3 focus-visible:ring-accent-400/30',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40 shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(239,68,68,0.25)]',
  ghost:
    'bg-transparent text-ink-mid hover:bg-surface-3 hover:text-ink-strong focus-visible:ring-accent-400/30',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/40 shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_1px_2px_rgba(16,185,129,0.25)]',
  warning:
    'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500/40 shadow-[0_1px_0_rgba(255,255,255,0.1)_inset]',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2.5 py-1 text-xs tracking-[0.01em]',
  md: 'px-4 py-2 text-sm tracking-[0.01em]',
  lg: 'px-6 py-3 text-base',
};

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-1 disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,background-color,border-color,box-shadow] duration-150 active:translate-y-0 hover:-translate-y-[1px]';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
