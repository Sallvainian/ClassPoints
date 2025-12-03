import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { HybridAppProvider } from './contexts/HybridAppContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { SyncStatus } from './components/common/SyncStatus';
import { MigrationWizard } from './components/migration/MigrationWizard';
import { Layout } from './components/layout';
import { DashboardView } from './components/dashboard';
import { ClassSettingsView } from './components/settings';
import { hasLocalStorageData } from './utils/migrateToSupabase';

type View = 'dashboard' | 'settings' | 'migration';

function AppContent() {
  const [view, setView] = useState<View>(() => {
    // Check if we need to show migration wizard
    if (hasLocalStorageData()) {
      return 'migration';
    }
    return 'dashboard';
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
      <Layout>
        {view === 'dashboard' ? (
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
        <HybridAppProvider>
          <AppContent />
        </HybridAppProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
