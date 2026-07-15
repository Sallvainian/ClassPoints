import { Home, School, User } from 'lucide-react';
import { useApp } from '../../contexts/useApp';

interface BottomNavProps {
  activeView: 'home' | 'dashboard' | 'settings' | 'profile';
  onNavigateHome?: () => void;
  onNavigateDashboard?: () => void;
  onNavigateProfile?: () => void;
}

interface TabProps {
  label: string;
  icon: typeof Home;
  active: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

function Tab({ label, icon: Icon, active, dimmed, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-disabled={dimmed || undefined}
      className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
        active ? 'text-accent-600 dark:text-accent-400' : 'text-ink-muted'
      }${dimmed ? ' opacity-40' : ''}`}
    >
      <Icon className="w-5 h-5" strokeWidth={1.75} />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
    </button>
  );
}

// Phone-only tab bar (md:hidden); the sidebar covers >=md. In-flow (not fixed)
// so in-flow bottom bars like BottomToolbar naturally stack above it; fixed
// toasts offset themselves via --app-bottom-nav-h (see index.css).
export function BottomNav({
  activeView,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateProfile,
}: BottomNavProps) {
  const { activeClassroomId } = useApp();
  const hasClassroom = activeClassroomId !== null;

  return (
    <nav className="md:hidden shrink-0 bg-surface-2 border-t border-hairline pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-14 items-stretch">
        <Tab label="Home" icon={Home} active={activeView === 'home'} onClick={onNavigateHome} />
        <Tab
          label="Class"
          icon={School}
          // A stale persisted 'dashboard' view with no classroom (e.g. deleted)
          // must not render the tab as both active and dimmed.
          active={(activeView === 'dashboard' || activeView === 'settings') && hasClassroom}
          dimmed={!hasClassroom}
          onClick={hasClassroom ? onNavigateDashboard : onNavigateHome}
        />
        <Tab
          label="Profile"
          icon={User}
          active={activeView === 'profile'}
          onClick={onNavigateProfile}
        />
      </div>
    </nav>
  );
}
