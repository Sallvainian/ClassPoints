# Project Overview

_Generated 2026-07-17 (exhaustive full rescan; HEAD `e34bbf3` on `main`)._

ClassPoints is a classroom-management app for teachers. It tracks per-student behavior points, classroom totals, today/this-week roll-ups, seating charts, and per-user sound feedback. It is a client-only React SPA — there is no app server; the browser talks directly to Supabase Auth + Postgres + Realtime + RLS + RPCs + one Edge Function. Since PRs #132/#136 the same codebase also ships as a **Capacitor 8 native app (iOS + Android)**, tuned iPad-first for touch. Licensed **PolyForm Noncommercial 1.0.0** (`LICENSE.md`, added `01c5ee3`).

## Snapshot

| Attribute          | Value                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Type               | Single-page web application, monolith — plus Capacitor native packaging (iOS + Android)                                     |
| Architecture       | React SPA + Supabase BaaS; Capacitor 8 WebView shell for native                                                             |
| Language           | TypeScript ~6.0.3, strict mode                                                                                              |
| Runtime (Node)     | `>=25` (`package.json` engines; `.nvmrc` = 25)                                                                              |
| Framework          | React 19.2.7 (React Compiler NOT enabled)                                                                                   |
| Build              | Vite 8.1.5 + `@vitejs/plugin-react` 6.0.3 (`base: '/ClassPoints/'` web, `'./'` capacitor mode)                              |
| Styling            | Tailwind CSS 4.3.3 + `@tailwindcss/postcss` 4.3.3 (v4 syntax only)                                                          |
| Server-state cache | TanStack Query 5.101.2 (devtools 5.101.2, dev-only)                                                                         |
| Backend            | `@supabase/supabase-js` 2.110.7                                                                                             |
| Validation         | Zod 4.4.3 (layout_data JSONB boundary)                                                                                      |
| Native shell       | Capacitor 8.4.2 (core/cli/ios/android) + preferences 8.0.1, status-bar 8.0.3, splash-screen 8.0.2, haptics 8.0.2, app 8.1.1 |
| Fonts              | Self-hosted `@fontsource` (Instrument Serif, Geist, JetBrains Mono) — no CDN                                                |
| Drag-and-drop      | `@dnd-kit/core` 6.3.1 + `@dnd-kit/utilities` 3.2.2                                                                          |
| Icons              | `lucide-react` 1.24.0 (sole library — no Heroicons / FontAwesome)                                                           |
| Tests              | Vitest 4.1.10 + jsdom 29.1.1 (44 files / 376 tests) + 8 integration files + Playwright 1.61.1 (6 specs, 4 projects)         |
| Lint / Format      | ESLint 10.7.0 (flat config) + `eslint-plugin-react-hooks` 7.1.1, Prettier 3.9.5                                             |
| Hooks              | `simple-git-hooks` + `lint-staged` 17.0.8 (pre-commit: eslint-fix + prettier + typecheck)                                   |
| Secrets            | `fnox` + age-encrypted `fnox.toml`                                                                                          |
| Env loader         | mise (`mise.toml`)                                                                                                          |
| Deploy             | GitHub Pages (web) + Xcode / Android Studio (native); Supabase migrations/functions auto-deploy on merge                    |
| Local DB           | Supabase CLI — brew-installed global (`supabase start` / `npm run dev` lifecycle); Postgres 17                              |
| License            | PolyForm Noncommercial 1.0.0                                                                                                |

## Current HEAD

`main` at `e34bbf3` (`fix(tests): use crypto randomness for uniqueSlug worker salt`). Since the previous generated-docs anchor at `134a1ef` (2026-06-02), **32 commits / 253 files** landed in three arcs:

1. **TanStack migration completed + data-layer hardening** (2026-06-09 → 06-11): `useSeatingChart` migrated to TanStack (Phase 5, PR #111) and `useLayoutPresets` migrated with its legacy realtime subscription deleted (#11, PR #112); `useRealtimeSubscription` legacy callback API collapsed to single `onChange` (#13, PR #113); atomic seating RPCs (#27, PR #114); Zod validation at the `layout_data` boundary (#15, PR #115); Supabase error handling normalized behind `unwrap()` (#14, PR #116); batched `get_student_time_totals_all_for_user` RPC (#8, PR #117); event-driven undo expiry + single transactions mount (#6/#22, PR #118); durable `batch_kind` undo labels (#7, PR #119); dnd-kit click-select fix (PR #120).
2. **Mobile + native** (2026-07): responsive phone shell + Capacitor iOS (PR #132); installed-app auth resilience — offline boot, password reset, change email, self-hosted fonts (PR #134); seating-editor touch support (PR #135); native shell integration — Preferences auth storage, status bar/splash/haptics, Android platform, `cap:*` scripts (PR #136); in-app account deletion + privacy policy for App Store 5.1.1(v) (PR #137) — including the `delete-account` Edge Function and the `SECURITY DEFINER` totals-trigger migration (`20260717033000`) its integration test surfaced.
3. **Housekeeping**: README + PolyForm Noncommercial license (`01c5ee3`), all 8 Dependabot alerts resolved via npm overrides (`4f1ea1f`), gitignore hardening, dependency bumps (Vite 8.1.5, supabase-js 2.110.7, Playwright 1.61.1, ESLint 10.7.0, lucide-react 1.24.0, …), CI: new `unit` + `integration` jobs in `test.yml`.

## What's in motion

- **TanStack migration: COMPLETE.** All six server-state domains are TanStack hooks; no hand-rolled server-state hooks remain. Remaining follow-ups are condition-gated defers only (e.g. #21 casing normalization).
- **Native/App Store track**: the Capacitor shell, account deletion, privacy policy, and touch-first seating editor position the app for iOS App Store submission; `ios/` + `android/` platforms are committed and CI-independent.
- **CI**: unit + integration now gate PRs in `test.yml` (previously local-only); E2E runs 4-sharded with a 10× burn-in.

## Quick reference

```bash
npm run dev              # Local-by-default dev server (auto-manages local Supabase)
npm run dev:hosted       # Hosted-Supabase fallback (fnox exec -- vite)
npm run build            # Production build (tsc -b && fnox exec -- vite build)
npm run check:bundle     # CI: assert no react-query-devtools in prod bundle
npm run cap:build        # Native bundle: vite build --mode capacitor + bundle check + cap sync
npm run cap:open:ios     # Open the Xcode project
npm run cap:assets       # Regenerate icons/splash from resources/
npm run lint             # ESLint
npm run typecheck        # tsc -b --noEmit && tsc -p tests/tsconfig.json --noEmit
npm test                 # Vitest watch
npm test -- --run        # Vitest single run
npm run test:integration # Vitest backend integration against LOCAL Supabase
npm run test:e2e         # Playwright (auto-starts/seeds/stops local Supabase)
npm run test:e2e:ui      # Playwright UI mode
npm run supabase:up      # Explicit local-stack lifecycle
npm run supabase:down
```

## Entry points

- App root: `src/main.tsx` → `src/App.tsx`
- Supabase client + error/auth helpers: `src/lib/supabase.ts` (`unwrap`, `isPostgrestError`, `isNetworkClassAuthError`)
- Query client: `src/lib/queryClient.ts`
- Query keys (single source of truth): `src/lib/queryKeys.ts`
- App UI/session context: `src/contexts/AppContext.tsx` (33 LOC — active-classroom selection only; Phase 4 dissolved the facade)
- Native shell config: `capacitor.config.ts`; bridge modules in `src/lib/` (`native.ts`, `haptics.ts`, `authStorage.ts`, `appUrl.ts`)

## See also

- [Architecture](./architecture.md) — full architectural detail
- [Data Models](./data-models.md) — schema, RLS, triggers, RPCs, Edge Function
- [State Management](./state-management.md) — TanStack patterns + auth resilience
- [Component Inventory](./component-inventory.md) — UI surface map
- [Source Tree Analysis](./source-tree-analysis.md) — directory walkthrough
- [Development Guide](./development-guide.md) — setup, scripts, CI/CD, native builds
- [ADR-005 QueryClient Defaults](./adr/ADR-005-queryclient-defaults.md) — authoritative §1-§6
- [Modernization Plan](./modernization-plan.md) — TanStack migration strategy (historical)
- [`_bmad-output/project-context.md`](../_bmad-output/project-context.md) — LLM-optimized rule digest
