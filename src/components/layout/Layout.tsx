import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
  onNavigateHome?: () => void;
  onSelectClassroom?: (classroomId: string) => void;
}

export function Layout({ children, onNavigateHome, onSelectClassroom }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar onNavigateHome={onNavigateHome} onSelectClassroom={onSelectClassroom} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
