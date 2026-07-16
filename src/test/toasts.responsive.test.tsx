import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { UndoToast } from '../components/points/UndoToast';
import { ErrorToast } from '../components/ui/ErrorToast';
import type { UndoableAction } from '../types';

// ── Toast responsive-offset regression ───────────────────────────────────────
// Pins the mobile-shell toast contract: both fixed toasts offset their bottom
// anchor by --app-bottom-nav-h (0px at md+, 3.5rem + safe-area below md — see
// index.css) so they float above the in-flow BottomNav on phones, and their
// fixed min-widths are viewport-clamped (`min(<px>,calc(100vw-2rem))`) so a
// 390px screen never gets a wider-than-viewport toast. jsdom cannot evaluate
// media queries or CSS vars — we assert the class strings.
//
// No existing test renders these toasts for their own markup (the
// DashboardView.undo-timer suite exercises UndoToast only incidentally, under
// fake-timer machinery), so this file renders them directly with minimal props.

const action: UndoableAction = {
  transactionId: 'txn-1',
  studentName: 'Aaliyah',
  behaviorName: 'Helping',
  points: 2,
  timestamp: Date.now(),
};

describe('UndoToast responsive placement', () => {
  it('offsets its bottom anchor by --app-bottom-nav-h and clamps width to the viewport', () => {
    const { container } = render(<UndoToast action={action} onUndo={vi.fn()} />);

    const fixed = container.firstElementChild as HTMLElement;
    expect(fixed).toHaveClass('fixed');
    expect(fixed.className).toContain('bottom-[calc(var(--app-bottom-nav-h)+1.5rem)]');

    const inner = fixed.firstElementChild as HTMLElement;
    expect(inner.className).toContain('min-w-[min(360px,calc(100vw-2rem))]');
    expect(inner.className).toContain('max-w-[calc(100vw-2rem)]');
    // The old unclamped width must stay gone — it overflowed 390px viewports.
    expect(inner.className).not.toContain('min-w-[360px]');
  });
});

describe('ErrorToast responsive placement', () => {
  it('offsets its bottom anchor by --app-bottom-nav-h and clamps width to the viewport', () => {
    const { container } = render(<ErrorToast error="Boom" onDismiss={vi.fn()} />);

    const fixed = container.firstElementChild as HTMLElement;
    expect(fixed).toHaveClass('fixed');
    expect(fixed.className).toContain('bottom-[calc(var(--app-bottom-nav-h)+5rem)]');

    const inner = fixed.firstElementChild as HTMLElement;
    expect(inner.className).toContain('min-w-[min(340px,calc(100vw-2rem))]');
    expect(inner.className).toContain('max-w-[calc(100vw-2rem)]');
    expect(inner.className).not.toContain('min-w-[340px]');
  });
});
