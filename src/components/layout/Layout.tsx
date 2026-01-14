import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
  onNavigateHome?: () => void;
}

export function Layout({ children, onNavigateHome }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar onNavigateHome={onNavigateHome} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
