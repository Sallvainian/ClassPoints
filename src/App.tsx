import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { SoundProvider } from './contexts/SoundContext';
import { HybridAppProvider } from './contexts/HybridAppContext';
import { useApp } from './contexts/AppContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { SyncStatus } from './components/common/SyncStatus';
import { MigrationWizard } from './components/migration/MigrationWizard';
import { Layout } from './components/layout';
import { DashboardView } from './components/dashboard';
import { ClassSettingsView } from './components/settings';
import { TeacherDashboard } from './components/home';
import { hasLocalStorageData } from './utils/migrateToSupabase';

type View = 'home' | 'dashboard' | 'settings' | 'migration';

function AppContent() {
  const { classrooms, setActiveClassroom } = useApp();
  const [view, setView] = useState<View>(() => {
    // Check if we need to show migration wizard
    if (hasLocalStorageData()) {
      return 'migration';
    }
    return 'home';
  });

  // Migration wizard view
  if (view === 'migration') {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <MigrationWizard
          onComplete={() => setView('dashboard')}
          onSkip={() => setView('dashboard')}
        />
      </div>
    );
  }

  return (
    <>
      <Layout onNavigateHome={() => setView('home')}>
        {view === 'home' ? (
          <TeacherDashboard
            onSelectClassroom={(id) => {
              const exists = classrooms.some((c) => c.id === id);
              if (!exists) {
                console.error('Classroom not found:', id);
                return;
              }
              setActiveClassroom(id);
              setView('dashboard');
            }}
          />
        ) : view === 'dashboard' ? (
          <DashboardView onOpenSettings={() => setView('settings')} />
        ) : (
          <ClassSettingsView onClose={() => setView('dashboard')} />
        )}
      </Layout>
      <SyncStatus />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGuard>
        <SoundProvider>
          <HybridAppProvider>
            <AppContent />
          </HybridAppProvider>
        </SoundProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
