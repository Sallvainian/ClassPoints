import { useEffect, type ReactNode } from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible label for the dialog. Read by screen readers. */
  ariaLabel: string;
  /** Tailwind class for max width (e.g. "max-w-lg", "max-w-2xl"). Default `max-w-md`. */
  maxWidth?: string;
  children: ReactNode;
}

/** Chromeless dialog primitive. Owner of the body content controls every pixel
 * inside; this component handles overlay, ARIA, escape-to-close, body scroll lock,
 * and the entry animation. Distinct from `Modal`, which enforces a title-and-body layout. */
export function Dialog({
  isOpen,
  onClose,
  ariaLabel,
  maxWidth = 'max-w-md',
  children,
}: DialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative bg-surface-2 border border-hairline rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)] w-full ${maxWidth} animate-scale-in overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}
