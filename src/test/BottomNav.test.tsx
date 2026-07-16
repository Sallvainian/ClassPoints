import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomNav } from '../components/layout/BottomNav';
import { AppProvider } from '../contexts/AppContext';
import type { ComponentProps } from 'react';

// BottomNav reads only useApp() (no supabase import chain), so the real
// AppProvider is enough — it hydrates activeClassroomId from localStorage,
// which setup.ts clears before each test (null unless a test seeds it).

const CLASSROOM_ID = 'class-1';

type BottomNavProps = ComponentProps<typeof BottomNav>;

function renderNav(props: Partial<BottomNavProps> = {}) {
  const handlers = {
    onNavigateHome: vi.fn(),
    onNavigateDashboard: vi.fn(),
    onNavigateProfile: vi.fn(),
  };
  render(
    <AppProvider>
      <BottomNav activeView="home" {...handlers} {...props} />
    </AppProvider>
  );
  return handlers;
}

function tab(name: 'Home' | 'Class' | 'Profile'): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('BottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the three tabs Home / Class / Profile inside an md:hidden nav', () => {
    renderNav();

    expect(tab('Home')).toBeInTheDocument();
    expect(tab('Class')).toBeInTheDocument();
    expect(tab('Profile')).toBeInTheDocument();

    // jsdom cannot evaluate media queries — pin the responsive class contract:
    // the tab bar exists only below md (the sidebar covers >=md).
    expect(screen.getByRole('navigation')).toHaveClass('md:hidden');
  });

  describe('active tab (aria-current + accent classes)', () => {
    it("marks Home active for activeView 'home'", () => {
      renderNav({ activeView: 'home' });

      expect(tab('Home')).toHaveAttribute('aria-current', 'page');
      expect(tab('Home').className).toContain('text-accent-600');
      expect(tab('Class')).not.toHaveAttribute('aria-current');
      expect(tab('Profile')).not.toHaveAttribute('aria-current');
    });

    it("marks Class active for activeView 'dashboard'", () => {
      window.localStorage.setItem('app:activeClassroomId', CLASSROOM_ID);
      renderNav({ activeView: 'dashboard' });

      expect(tab('Class')).toHaveAttribute('aria-current', 'page');
      expect(tab('Class').className).toContain('text-accent-600');
      expect(tab('Home')).not.toHaveAttribute('aria-current');
      expect(tab('Profile')).not.toHaveAttribute('aria-current');
    });

    it("marks Class active for activeView 'settings' (settings is a class-scoped view)", () => {
      window.localStorage.setItem('app:activeClassroomId', CLASSROOM_ID);
      renderNav({ activeView: 'settings' });

      expect(tab('Class')).toHaveAttribute('aria-current', 'page');
      expect(tab('Class').className).toContain('text-accent-600');
    });

    it("never marks Class active without a classroom, even for activeView 'dashboard' (stale persisted view)", () => {
      renderNav({ activeView: 'dashboard' });

      expect(tab('Class')).not.toHaveAttribute('aria-current');
      expect(tab('Class').className).not.toContain('text-accent-600');
      expect(tab('Class')).toHaveClass('opacity-40');
      expect(tab('Class')).toHaveAttribute('aria-disabled', 'true');
    });

    it("marks Profile active for activeView 'profile'", () => {
      renderNav({ activeView: 'profile' });

      expect(tab('Profile')).toHaveAttribute('aria-current', 'page');
      expect(tab('Profile').className).toContain('text-accent-600');
      expect(tab('Class')).not.toHaveAttribute('aria-current');
    });
  });

  describe('without an active classroom', () => {
    it('dims the Class tab (opacity-40)', () => {
      renderNav();

      expect(tab('Class')).toHaveClass('opacity-40');
      expect(tab('Home')).not.toHaveClass('opacity-40');
      expect(tab('Profile')).not.toHaveClass('opacity-40');
    });

    it('routes a Class tap to onNavigateHome, never onNavigateDashboard', async () => {
      const handlers = renderNav();

      await userEvent.click(tab('Class'));

      expect(handlers.onNavigateHome).toHaveBeenCalledTimes(1);
      expect(handlers.onNavigateDashboard).not.toHaveBeenCalled();
    });
  });

  describe('with an active classroom', () => {
    beforeEach(() => {
      // setup.ts clears localStorage in its own beforeEach (runs first); seed
      // afterwards so AppProvider hydrates the classroom on mount — same dance
      // as DashboardView.undo-timer.test.tsx.
      window.localStorage.setItem('app:activeClassroomId', CLASSROOM_ID);
    });

    it('does not dim the Class tab', () => {
      renderNav();

      expect(tab('Class')).not.toHaveClass('opacity-40');
    });

    it('routes a Class tap to onNavigateDashboard', async () => {
      const handlers = renderNav();

      await userEvent.click(tab('Class'));

      expect(handlers.onNavigateDashboard).toHaveBeenCalledTimes(1);
      expect(handlers.onNavigateHome).not.toHaveBeenCalled();
    });
  });

  it('fires onNavigateHome / onNavigateProfile from their tabs', async () => {
    const handlers = renderNav();

    await userEvent.click(tab('Home'));
    expect(handlers.onNavigateHome).toHaveBeenCalledTimes(1);

    await userEvent.click(tab('Profile'));
    expect(handlers.onNavigateProfile).toHaveBeenCalledTimes(1);
    expect(handlers.onNavigateDashboard).not.toHaveBeenCalled();
  });
});
