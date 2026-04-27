import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { SoundProvider } from './contexts/SoundContext';
import { AppProvider, useApp } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { SyncStatus } from './components/common/SyncStatus';
import { Layout } from './components/layout';
import { hasLocalStorageData } from './utils/migrateToSupabase';

const MigrationWizard = lazy(() =>
  import('./components/migration/MigrationWizard').then((m) => ({ default: m.MigrationWizard }))
);
const DashboardView = lazy(() =>
  import('./components/dashboard').then((m) => ({ default: m.DashboardView }))
);
const ClassSettingsView = lazy(() =>
  import('./components/settings').then((m) => ({ default: m.ClassSettingsView }))
);
const ProfileView = lazy(() =>
  import('./components/profile').then((m) => ({ default: m.ProfileView }))
);
const TeacherDashboard = lazy(() =>
  import('./components/home').then((m) => ({ default: m.TeacherDashboard }))
);

function ViewFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-hairline border-t-accent-500" />
    </div>
  );
}

type View = 'home' | 'dashboard' | 'settings' | 'migration' | 'profile';

const VIEW_STORAGE_KEY = 'app:view';
const PERSISTED_VIEWS: View[] = ['home', 'dashboard', 'settings', 'profile'];

function AppContent() {
  const { classrooms, setActiveClassroom } = useApp();
  const [view, setView] = useState<View>(() => {
    // Migration wizard takes precedence (one-time flow, not persisted).
    if (hasLocalStorageData()) return 'migration';
    if (typeof window === 'undefined') return 'home';
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    return stored && PERSISTED_VIEWS.includes(stored) ? stored : 'home';
  });

  // Persist view across refreshes (skip migration; it's ephemeral).
  useEffect(() => {
    if (view === 'migration') return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  // Migration wizard view
  if (view === 'migration') {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center p-4">
        <Suspense fallback={<ViewFallback />}>
          <MigrationWizard
            onComplete={() => setView('dashboard')}
            onSkip={() => setView('dashboard')}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <>
      <Layout
        onNavigateHome={() => setView('home')}
        onNavigateProfile={() => setView('profile')}
        onSelectClassroom={(id) => {
          const exists = classrooms.some((c) => c.id === id);
          if (!exists) {
            console.error('Classroom not found:', id);
            return;
          }
          setActiveClassroom(id);
          setView('dashboard');
        }}
      >
        <Suspense fallback={<ViewFallback />}>
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
          ) : view === 'profile' ? (
            <ProfileView onClose={() => setView('home')} />
          ) : (
            <ClassSettingsView onClose={() => setView('dashboard')} />
          )}
        </Suspense>
      </Layout>
      <SyncStatus />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGuard>
        <ThemeProvider>
          <SoundProvider>
            <AppProvider>
              <AppContent />
            </AppProvider>
          </SoundProvider>
        </ThemeProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
