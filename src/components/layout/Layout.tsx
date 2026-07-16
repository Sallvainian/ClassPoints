import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
  activeView: 'home' | 'dashboard' | 'settings' | 'profile';
  onNavigateHome?: () => void;
  onNavigateDashboard?: () => void;
  onNavigateProfile?: () => void;
  onSelectClassroom?: (classroomId: string) => void;
}

export function Layout({
  children,
  activeView,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateProfile,
  onSelectClassroom,
}: LayoutProps) {
  return (
    <div className="flex h-dvh flex-col md:flex-row bg-surface-1 text-ink-strong">
      <Sidebar
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile}
        onSelectClassroom={onSelectClassroom}
      />
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      <BottomNav
        activeView={activeView}
        onNavigateHome={onNavigateHome}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateProfile={onNavigateProfile}
      />
    </div>
  );
}
