import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Layout } from '../components/layout/Layout';

// ── Responsive shell contract regression ─────────────────────────────────────
// Pins the mobile-shell class contract on the REAL Layout/Sidebar/BottomNav
// trees: root column-on-phone/row-on-desktop, sidebar hidden below md, bottom
// nav hidden at/above md, main pane min-h-0 so it shrinks instead of pushing
// the in-flow BottomNav off-screen. jsdom cannot evaluate media queries — we
// assert the class strings, not computed layout.
//
// The Sidebar child is rendered for real (its `hidden md:flex` aside IS the
// contract under test), so its data hooks are mocked at the hook-module level
// (TeacherDashboard.test.tsx precedent) — the mocked modules never load, so
// the credless-CI supabase chain is never reached.

vi.mock('../contexts/useApp', () => ({
  useApp: () => ({ activeClassroomId: null, setActiveClassroom: vi.fn() }),
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com', user_metadata: { name: 'Test Teacher' } },
    signOut: vi.fn(),
  }),
}));

vi.mock('../contexts/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn(), setTheme: vi.fn() }),
}));

vi.mock('../hooks/useAppClassrooms', () => ({
  useAppClassrooms: () => ({ classrooms: [], isLoading: false, error: null }),
}));

vi.mock('../hooks/useClassrooms', () => ({
  useCreateClassroom: () => ({ mutate: vi.fn() }),
}));

function renderShell() {
  return render(
    <Layout activeView="home">
      <p>page content</p>
    </Layout>
  );
}

describe('Layout responsive shell contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('root is a full-height flex shell: column on phone, row at md', () => {
    const { container } = renderShell();

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('flex');
    expect(root).toHaveClass('h-dvh');
    expect(root).toHaveClass('flex-col');
    expect(root).toHaveClass('md:flex-row');
  });

  it('sidebar aside is hidden below md and a flex column at md+', () => {
    const { container } = renderShell();

    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside).toHaveClass('hidden');
    expect(aside).toHaveClass('md:flex');
    expect(aside).toHaveClass('w-64');
  });

  it('BottomNav is present and md:hidden', () => {
    renderShell();

    // The shell contains two navs (sidebar classroom list + tab bar); anchor on
    // a tab button to pick the BottomNav one.
    const nav = screen.getByRole('button', { name: 'Class' }).closest('nav');
    expect(nav).not.toBeNull();
    expect(nav).toHaveClass('md:hidden');
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
  });

  it('main pane fills the shell, may shrink (min-h-0), and clips overflow', () => {
    renderShell();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-1');
    expect(main).toHaveClass('min-h-0');
    expect(main).toHaveClass('overflow-hidden');
    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});
