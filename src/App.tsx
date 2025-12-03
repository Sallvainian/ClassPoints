import { useState } from 'react';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/layout';
import { DashboardView } from './components/dashboard';
import { ClassSettingsView } from './components/settings';

type View = 'dashboard' | 'settings';

function AppContent() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <Layout>
      {view === 'dashboard' ? (
        <DashboardView onOpenSettings={() => setView('settings')} />
      ) : (
        <ClassSettingsView onClose={() => setView('dashboard')} />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
