# 9. localStorage Strategy

## Persistence Hook

```typescript
// src/hooks/usePersistedState.ts

const STORAGE_KEY = 'seating-chart-data';
const CURRENT_VERSION = 1;

const DEFAULT_STATE: AppState = {
  version: CURRENT_VERSION,
  classes: [],
  lastActiveClassId: null,
};

export function usePersistedState() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_STATE;

      const parsed = JSON.parse(stored);
      return migrateState(parsed);
    } catch (error) {
      console.error('Failed to load state:', error);
      return DEFAULT_STATE;
    }
  });

  // Debounced save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          // Handle quota exceeded - notify user
          console.error('localStorage quota exceeded');
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [state]);

  return [state, setState] as const;
}
```

## Schema Migration

```typescript
// src/utils/migrations.ts

export function migrateState(state: unknown): AppState {
  if (!state || typeof state !== 'object') {
    return DEFAULT_STATE;
  }

  const version = (state as any).version || 0;

  // Future migrations go here
  // if (version < 2) state = migrateV1toV2(state);

  return state as AppState;
}
```

## Data Backup/Restore

```typescript
// src/utils/backup.ts

export function exportData(): string {
  const data = localStorage.getItem(STORAGE_KEY);
  return data || JSON.stringify(DEFAULT_STATE);
}

export function importData(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    const migrated = migrateState(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return true;
  } catch {
    return false;
  }
}

export function downloadBackup() {
  const data = exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `seating-chart-backup-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
```

---
