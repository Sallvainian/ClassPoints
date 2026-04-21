# State Management

_Last generated: 2026-04-21 — Source of truth: `src/App.tsx`, `src/contexts/*.tsx`, `src/hooks/*.ts`._

ClassPoints uses **React Context + hand-rolled data hooks** for all state management. There is **no TanStack Query, Redux, Zustand, or Jotai** — despite what `_bmad-output/project-context.md` says about a "state management direction" migration; the migration is not installed. This doc describes what the code actually does.

---

## Context Provider Hierarchy

From `src/App.tsx`, in strict outer-to-inner order:

```
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
```

**Rules this hierarchy encodes:**

1. `AuthProvider` outermost — every layer below can read the Supabase session.
2. `AuthGuard` short-circuits render when unauthenticated. Nothing inside it mounts until login succeeds. This is why `AppProvider` can assume an authenticated user exists.
3. `ThemeProvider` is between `AuthGuard` and `SoundProvider` — it reads/writes `localStorage` and applies a `dark` class to `<html>`. It does not depend on auth, but putting it inside the guard means it only mounts for logged-in users (sign-in screens get the default theme).
4. `SoundProvider` depends on `AuthContext` (loads `user_sound_settings` per user).
5. `AppProvider` depends on `AuthContext` (its data hooks query tables scoped by `auth.uid()` via RLS).

**Do not reorder this tree.** Rearranging breaks the dependency graph in ways TypeScript won't catch — e.g., `AppProvider` would query with a null session and `useStudents` would return an empty array with no error.

---

## The Four Contexts

### `AuthContext` — `src/contexts/AuthContext.tsx`

Owns the Supabase auth session. Exposes:

- `user`, `session` — `User | null`, `Session | null` from `@supabase/supabase-js`
- `loading`, `error`
- `signUp(email, password, name?) → { success, error? }`
- `signIn(email, password) → { success, error? }`
- `signOut()`
- `resetPassword(email)` — sends email with redirect to `${origin}/reset-password`
- `updatePassword(password)`
- `clearError()`

Subscribes to `supabase.auth.onAuthStateChange` on mount. Returns an unsubscribe in the effect cleanup. `useAuth()` throws if called outside `AuthProvider`.

### `ThemeContext` — `src/contexts/ThemeContext.tsx`

Light/dark theme. Exposes:

- `theme: 'light' | 'dark'`
- `toggleTheme()`
- `setTheme(next)`

Initial theme resolves from `localStorage['theme']`, falling back to `window.matchMedia('(prefers-color-scheme: dark)')`. Applies a `dark` class to `document.documentElement` via effect. Persists every change to `localStorage`. Cheap, no network.

### `SoundContext` — `src/contexts/SoundContext.tsx`

Per-user sound preferences + preloaded Web Audio buffers. Exposes:

- `settings: SoundSettings` — `{ enabled, volume, positiveSound, negativeSound, customPositiveUrl, customNegativeUrl }`
- `isLoading`, `error`
- `updateSettings(updates)` — upserts to `user_sound_settings`, reverts local state on error
- `audioContext: AudioContext | null`
- `soundBuffers: Map<SoundId, AudioBuffer>`
- `isAudioReady: boolean`

Behavior worth knowing:

- **Autoplay workaround:** mounts a one-shot `click`/`keydown` listener on `document` that calls `audioContext.resume()`. Required on Safari and browsers with strict autoplay policies. Listeners remove themselves after first fire.
- **Synthesized buffers:** all built-in sounds are synthesized from `SOUND_DEFINITIONS` (`src/assets/sounds`) into `AudioBuffer`s at provider init — not fetched from disk.
- **Custom sound URLs** (optional): the `useSoundEffects` hook fetches + caches these separately in `customBuffersRef`.
- **Error code PGRST116:** Supabase's "no rows" — expected on first-time users. `SoundContext` treats it as "use defaults."

### `AppContext` — `src/contexts/AppContext.tsx`

The application facade. Exposes classroom/student/behavior/transaction state + operations via a single `useApp()` hook. This is the **one** context components should import for app state — never the others directly.

Owns:

- `activeClassroomId` — persisted to `localStorage['app:activeClassroomId']`. Active classroom identity survives refresh.
- Composed hooks: `useClassrooms()`, `useStudents(activeClassroomId)`, `useBehaviors()`, `useTransactions(activeClassroomId)`.
- Derived: `mappedClassrooms`, `mappedStudents`, `mappedBehaviors`, `activeClassroom` — all memoized transforms from `snake_case` DB shapes to `camelCase` app shapes.
- Combined `loading = any child loading`, `error = first child error`.

Exposes (see `AppContextValue` interface in the file for the full list):

- **Classrooms**: `classrooms`, `activeClassroomId`, `activeClassroom`, `createClassroom`, `updateClassroom`, `deleteClassroom`, `setActiveClassroom`
- **Students**: `students`, `addStudent`, `addStudents`, `updateStudent`, `removeStudent`
- **Behaviors**: `behaviors`, `addBehavior`, `updateBehavior`, `deleteBehavior`, `resetBehaviorsToDefault`
- **Transactions & points**: `transactions`, `awardPoints`, `awardClassPoints`, `awardPointsToStudents`, `undoTransaction`, `undoBatchTransaction`, `getStudentPoints`, `getClassPoints`, `getStudentTransactions`, `getClassroomTransactions`, `getRecentUndoableAction`, `clearStudentPoints`, `adjustStudentPoints`, `resetClassroomPoints`

Invariants to respect:

- **`getStudentPoints` reads from stored columns**, not by reducing transactions. This is deliberate — transactions are the audit log, not the aggregation. Components must not sum `transactions[]` client-side to display a total.
- **Class-wide awards are atomic batches.** `awardClassPoints` and `awardPointsToStudents` generate a shared `batch_id` and insert all transactions in one `supabase.from(...).insert(rows)` call. `undoBatchTransaction(batchId)` deletes them all.
- **Undo window is 10s** (`UNDO_WINDOW_MS`). `getRecentUndoableAction()` returns `null` if the most recent transaction is older than 10 seconds.
- **Empty `studentIds` array means no-op** — `getClassPoints` with an empty selection returns zero totals, not a sum-of-all.

---

## Data Hook Pattern

Supabase data hooks (`useClassrooms`, `useStudents`, `useBehaviors`, `useTransactions`, `useSeatingChart`, `useLayoutPresets`) follow a uniform shape:

```ts
interface UseXReturn {
  <domain>: X[];            // the data
  loading: boolean;
  error: Error | null;
  // CRUD operations — return the saved row, or null/error
  addX(...): Promise<X | null>;
  updateX(id, updates): Promise<X | null>;
  removeX(id): Promise<boolean>;
  // optional: optimistic update helper for parent contexts
  updateXOptimistically?(...): void;
  refetch: () => Promise<void>;
}
```

Do **not** invent a new return shape for new data hooks. Match this one — it's what `AppContext` composes.

### The fetch/subscribe/transform skeleton

Every Supabase hook follows the same shape:

```ts
export function useX(scopeId: string | null): UseXReturn {
  const [data, setData] = useState<X[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    // 1. .select('*') scoped by RLS and any client filter
    // 2. on error: setError + return
    // 3. transform snake_case → camelCase if needed
    // 4. setData(rows)
  }, [scopeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useRealtimeSubscription<Row>({
    table: 'x',
    filter: scopeId ? `classroom_id=eq.${scopeId}` : undefined,
    enabled: !!scopeId,
    onInsert: (row) =>
      setData((prev) => (prev.some((r) => r.id === row.id) ? prev : sortX([...prev, row]))),
    onUpdate: (row) => setData((prev) => sortX(prev.map((r) => (r.id === row.id ? row : r)))),
    onDelete: ({ id }) => setData((prev) => prev.filter((r) => r.id !== id)),
  });

  // CRUD + optimistic helpers return { data, loading, error, ..., refetch: fetchAll };
}
```

**The "dedupe on INSERT" branch** (`if (prev.some(r => r.id === row.id)) return prev`) is load-bearing — without it, optimistic-inserted rows get duplicated when the realtime event arrives.

### `useRealtimeSubscription` — the helper

`src/hooks/useRealtimeSubscription.ts` wraps Supabase's `supabase.channel(...)` primitive.

- **Callback refs:** callbacks are stored in refs so the subscription doesn't tear down on every render when callbacks capture fresh state.
- **Clean teardown:** the effect's cleanup calls `supabase.removeChannel(channel)`. Enabling/disabling via `enabled: false` does the same. Switching `filter` or `table` rebuilds the channel.
- **`onReconnect` callback:** fires when transitioning SUBSCRIBED after a `CHANNEL_ERROR | TIMED_OUT | CLOSED` — use this to refetch so events missed while offline don't silently disappear. Used by `SyncStatus` and by hooks that need to recover from transient disconnects.
- **`enabled` gate:** `enabled: !!classroomId` in per-classroom hooks. When the classroom changes, the previous channel is torn down and a new one subscribed.

Do **not** call `supabase.channel(...)` directly — always use this helper. If you think you need raw channel access, the helper can almost certainly be extended.

### Optimistic update contract

When mutating data that will echo back through realtime:

1. **Capture rollback state.** For adjusted columns only, remember the previous value (or delta).
2. **Apply optimistically.** e.g., `updateStudentPointsOptimistically(id, +pts)` updates the local `students[]` immediately.
3. **Mirror at every level.** `AppContext.awardPoints` updates BOTH the student row AND the classroom summary, because the realtime event will update the student row later — and if the classroom summary already reflects the change, the realtime delta calculation on `useClassrooms.onUpdate` will be zero (no double-count).
4. **Execute the mutation.** `await supabase.from(...).insert(...)`.
5. **On error: rollback.** Apply the negated delta, set the error state, throw/re-raise so callers can surface a toast.
6. **On success: do nothing.** The realtime event will reconcile. `refetch()` on success path causes a visible flicker.

The `updateClassroomPointsOptimistically` + `updateStudentPointsOptimistically` pair in `useClassrooms` + `useStudents` exists specifically to make this work. **Do not short-circuit** by calling `refetch()` instead of optimistic updates — the network round-trip is visible to users.

### Time-based totals pattern

Lifetime totals (`point_total`, `positive_total`, `negative_total`) live in stored columns on `students`, maintained by a DB trigger. They arrive via realtime.

Today/week totals (`today_total`, `this_week_total`) live only in app memory:

1. Initial fetch: `useStudents` calls `supabase.rpc('get_student_time_totals', ...)` in parallel with the base `.select('*')`.
2. Merge: both results are combined into `StudentWithPoints[]`.
3. Optimistic updates: `updateStudentPointsOptimistically` adds/subtracts from both time totals too.
4. Visibility-based refresh: `useStudents` attaches a `visibilitychange` listener. When the tab returns to foreground, `fetchTimeTotals()` runs — this handles the case where "today" rolls over while the tab was backgrounded.

Do not store today/week totals in DB columns. The RPC is cheap because the composite index `idx_transactions_classroom_created` bounds the scan.

---

## Hook Inventory

### Supabase-backed (composed by `AppContext` or feature-scoped)

| Hook                           | File                            | Scope                        | Realtime subscriptions                                              |
| ------------------------------ | ------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `useClassrooms`                | `src/hooks/useClassrooms.ts`    | global (user-scoped via RLS) | `classrooms`, `students`                                            |
| `useStudents(classroomId)`     | `src/hooks/useStudents.ts`      | per-classroom                | `students` (filtered), `point_transactions` (filtered, DELETE only) |
| `useBehaviors`                 | `src/hooks/useBehaviors.ts`     | global                       | `behaviors`                                                         |
| `useTransactions(classroomId)` | `src/hooks/useTransactions.ts`  | per-classroom                | `point_transactions` (filtered)                                     |
| `useSeatingChart(classroomId)` | `src/hooks/useSeatingChart.ts`  | per-classroom                | none — no realtime on seating tables                                |
| `useLayoutPresets`             | `src/hooks/useLayoutPresets.ts` | global (user-scoped via RLS) | `layout_presets`                                                    |

### UI / session hooks (no network)

| Hook                                            | File                               | Purpose                                                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDisplaySettings`                            | `src/hooks/useDisplaySettings.ts`  | Card size, show-totals toggle, view mode — persisted to `localStorage['classpoints-display-settings']`                                                                              |
| `useRotatingCategory({categories, intervalMs})` | `src/hooks/useRotatingCategory.ts` | Auto-cycle through a category list (default 7s). Manual select resets the timer.                                                                                                    |
| `useAvatarColor(rawColor)`                      | `src/hooks/useAvatarColor.ts`      | Returns `{ bg, textClass }` for an avatar in the current theme. For lists, call `useTheme()` once and use the non-hook `resolveAvatarDisplay(color, isDark)` variant inside `.map`. |

### Audio hook

| Hook                             | File                           | Purpose                                                                                                                                                  |
| -------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSoundEffects({ testMode? })` | `src/hooks/useSoundEffects.ts` | `playPositive()`, `playNegative()`, `setVolume(0-100)`, `toggleMute()`. Consumes `SoundContext`. `testMode: true` logs instead of playing (used in E2E). |

### Legacy

| Hook                | File                             | Note                                                                                                                                                                                              |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usePersistedState` | `src/hooks/usePersistedState.ts` | **Legacy.** Pure-localStorage store, predates Supabase. Used only by the `MigrationWizard` flow (`src/utils/migrateToSupabase.ts`). Do NOT add new callers — it bypasses authentication entirely. |

`src/hooks/index.ts` is a barrel file. It intentionally does NOT re-export Supabase hooks from contexts — those go through `useApp()`.

---

## Where State Lives

| Concern                                                     | Location                                                                               | Lifetime                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| Auth session                                                | `AuthContext`, backed by `supabase.auth.getSession()`                                  | browser tab                      |
| Active classroom ID                                         | `AppContext` + `localStorage['app:activeClassroomId']`                                 | across refreshes                 |
| Current view (`home`/`dashboard`/...)                       | `AppContent` `useState` + `localStorage['app:view']` (migration view is not persisted) | across refreshes                 |
| Theme                                                       | `ThemeContext` + `localStorage['theme']`                                               | across refreshes                 |
| Sound settings                                              | `SoundContext` + Supabase `user_sound_settings`                                        | syncs across devices             |
| Display settings (card size, etc.)                          | `useDisplaySettings` + `localStorage['classpoints-display-settings']`                  | across refreshes, per-device     |
| Server data (classrooms, students, behaviors, transactions) | Data hooks, reconciled by realtime                                                     | per session, re-fetched on mount |
| Seating chart                                               | `useSeatingChart` per classroom                                                        | per session                      |
| Legacy local-only points                                    | `usePersistedState` + `localStorage['classroom-points-data']`                          | pre-migration only               |

---

## Anti-Patterns (seen and warned against in the codebase)

```ts
// BAD — hook called after early return
export function Card({ x }: Props) {
  if (!x) return null;
  const { foo } = useApp(); // CRASH on next render when x flips truthy
}

// BAD — aggregating transactions client-side for totals
const total = transactions.reduce((s, t) => s + t.points, 0); // stale, expensive
// GOOD
const { total } = getStudentPoints(studentId); // reads stored columns

// BAD — direct context import from component
import { AppContext } from '../contexts/AppContext';
const ctx = useContext(AppContext);
// GOOD
import { useApp } from '../contexts/AppContext';
const { ... } = useApp();

// BAD — no subscription cleanup
useEffect(() => { supabase.channel('x').subscribe(); }, []);
// GOOD — use the helper
useRealtimeSubscription({ table: 'x', onInsert, onUpdate, onDelete });
// OR if you really must hand-roll:
useEffect(() => {
  const ch = supabase.channel('x').subscribe();
  return () => supabase.removeChannel(ch);
}, []);

// BAD — refetch on success path
await supabase.from('students').insert(row);
await refetch(); // causes flicker; realtime will reconcile

// BAD — storing derived values in useState
const [total, setTotal] = useState(0);
useEffect(() => setTotal(students.reduce(...)), [students]); // drifts
// GOOD — compute inline or useMemo
const total = useMemo(() => students.reduce(...), [students]);
```
