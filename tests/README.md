# ClassPoints Test Suite

Two layers, two runners. Choose by what you're testing.

| Layer               | Where                            | Runner                | What it touches                                           | Speed                        |
| ------------------- | -------------------------------- | --------------------- | --------------------------------------------------------- | ---------------------------- |
| Unit                | `src/**/*.test.{ts,tsx}`         | Vitest 4 + jsdom      | Pure functions / hooks / components with mocked Supabase  | Fast (sub-second per file)   |
| Backend integration | `tests/integration/**/*.test.ts` | Vitest 4 + node       | Real (local) Supabase via service-role admin client       | Medium (network round trips) |
| E2E                 | `tests/e2e/**/*.spec.ts`         | Playwright (Chromium) | Real browser → real Vite dev server → real local Supabase | Slow (full stack, full auth) |

**E2E and backend-integration suites both refuse to run against anything that isn't loopback / RFC1918 / Tailscale CGNAT.** The guards live in `playwright.config.ts` and `vitest.integration.config.ts`. Substring matching is unsafe (`https://127.0.0.1.evil.com` would otherwise pass) — both configs parse with `new URL(...).hostname` and check the hostname against the allow-list.

---

## Setup (one-time)

1. **Install Supabase CLI binary** (one-time, host-level):

   ```
   brew install supabase/tap/supabase    # macOS
   ```

   The `supabase` npm devDep is already in `package.json`; the CLI binary is what `npx supabase start` shells out to.

2. **Copy the local-creds template:**

   ```
   cp .env.test.example .env.test
   ```

   Then edit `.env.test` and fill in the values from `npx supabase status` (anon key + service-role key + URL). `.env.test` is gitignored.

3. **Verify local stack boots:**
   ```
   npx supabase start
   npx supabase status
   npx supabase stop
   ```

After that, `npm run test:e2e` and `npm run test:integration` manage the local Supabase lifecycle automatically.

---

## Running tests

| Command                                         | What it does                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                      | Vitest unit suite, watch mode                                                                                       |
| `npm test -- --run`                             | Vitest unit suite, single pass                                                                                      |
| `npm test -- src/test/specificFile.test.ts`     | Single unit file                                                                                                    |
| `npm run test:integration`                      | Backend-integration suite (Vitest, Node, real local Supabase) — single pass                                         |
| `npm run test:e2e`                              | Full Playwright run (auto-starts local Supabase if it points at this machine; auto-stops if globalSetup started it) |
| `npm run test:e2e -- tests/e2e/example.spec.ts` | Single E2E file                                                                                                     |
| `npm run test:e2e:ui`                           | Playwright with UI mode (interactive)                                                                               |
| `npm run test:e2e -- --headed --debug`          | Headed + Playwright Inspector                                                                                       |
| `npx playwright show-report`                    | Open the last HTML report                                                                                           |
| `npm run test:seed`                             | Manually seed the test user (rarely needed — `globalSetup` does this idempotently)                                  |
| `npm run supabase:up` / `:down`                 | Explicit local stack lifecycle (e.g., when switching projects on the same port)                                     |

---

## Architecture

```
tests/
├── e2e/
│   ├── auth.setup.ts        # `setup` project — login via UI, capture .auth/user.json
│   ├── global-setup.ts      # Boot local Supabase (only if URL points here), seed test user
│   ├── global-teardown.ts   # Stop local Supabase (only if globalSetup started it)
│   └── example.spec.ts      # Sample E2E specs (Given/When/Then)
├── integration/
│   └── example.test.ts      # Sample Supabase backend-integration tests
├── support/
│   ├── fixtures/
│   │   ├── index.ts         # mergeTests(logTest, apiRequestTest, recurseTest) + userFactory
│   │   └── factories/
│   │       └── user.factory.ts  # UserFactory class — create() / cleanup(), no faker
│   ├── helpers/
│   │   ├── auth.ts          # loginViaUi() — fallback for tests that bypass storageState
│   │   ├── supabase-admin.ts # Cached service-role client for direct DB access
│   │   └── unique.ts        # uniqueSlug() — Date.now() + counter, parallel-safe
│   └── page-objects/        # (empty — page-object pattern available but unused so far)
├── tsconfig.json            # Tests-scoped tsconfig (extends ../tsconfig.app.json)
└── README.md                # This file
```

### Fixture composition (`tests/support/fixtures/index.ts`)

E2E specs import from this single file:

```ts
import { test, expect } from '../support/fixtures';
```

The `test` object merges:

- `logTest` — Playwright report-integrated structured logging
- `apiRequestTest` — typed HTTP client with retry + schema validation
- `recurseTest` — polling helper for eventual consistency
- `userFactory` (custom) — auto-cleanup user lifecycle for tests that need one

`mergeTests` is the canonical playwright-utils composition pattern. Add new fixtures here, never import multiple `test` objects in a spec.

**Network-error-monitor is intentionally OFF.** Supabase's PostgREST returns expected 4xx for empty `select(...).single()` results, and Realtime emits expected 4xx during reconnects. Enabling the monitor naively would fail every UI test. To turn it on with a curated allow-list, follow the recipe in the source comments at `tests/support/fixtures/index.ts:5-9`.

### Auth strategy

Browser auth uses Playwright's standard `setup` project + `storageState` pattern:

1. The `setup` project (`auth.setup.ts`) runs once per Playwright invocation, signs in via the UI, and writes cookies/localStorage to `.auth/user.json` (gitignored).
2. The `chromium` project depends on `setup` and loads `.auth/user.json` as `storageState` for every spec.

Tests that need a fresh auth (e.g., negative-path tests, multi-user tests) can either override `storageState` per file (`test.use({ storageState: ... })`) or call `loginViaUi()` from `tests/support/helpers/auth.ts`.

**`@seontechnologies/playwright-utils` `auth-session` fixture is NOT used** — it's designed for token/Bearer auth, not Supabase's cookie-based session model. Don't introduce it unless the auth surface changes.

### Factories

`UserFactory` is the canonical pattern. Per-test instance, tracked-and-cleaned-up via the fixture teardown:

```ts
test('Given a user, ...', async ({ userFactory }) => {
  const user = await userFactory.create({ email: 'override@test.local' });
  // ...
  // Auto-cleanup runs after the test ends.
});
```

To add new factories (Classroom, Student, Behavior, Transaction):

1. Create `tests/support/fixtures/factories/<name>.factory.ts` mirroring `user.factory.ts`.
2. Use `uniqueSlug()` from `tests/support/helpers/unique.ts` for IDs/names — collision-safe across parallel workers without faker.
3. Track created IDs on the instance; clean up in `cleanup()`.
4. Wire into `tests/support/fixtures/index.ts`:
   ```ts
   type LocalFixtures = { userFactory: UserFactory; classroomFactory: ClassroomFactory };
   export const test = merged.extend<LocalFixtures>({
     userFactory: async ({}, provide) => {
       /* ... */
     },
     classroomFactory: async ({}, provide) => {
       const f = new ClassroomFactory();
       await provide(f);
       await f.cleanup();
     },
   });
   ```

---

## Best practices

### Selectors (E2E)

Order of preference:

1. `getByRole(...)` — built-in accessibility checks
2. `getByLabel(...)` — works for any labeled control (form fields, buttons with `aria-label`)
3. `getByText(...)` — for unique non-interactive content
4. `getByTestId(...)` — when text/role aren't stable
5. `locator(cssSelector)` — last resort

Do **not** use `page.locator('.some-class')` for primary identification — Tailwind utility classes change frequently.

### No arbitrary waits

`waitForTimeout()` is banned in new tests. The project context flagged the pre-existing `auth.setup.ts:33` `waitForTimeout(1000)` as debt — it's been removed in this scaffold. Use:

- `await expect(locator).toBeVisible()` for UI markers
- `await page.waitForLoadState('networkidle')` for "all the in-flight requests finished"
- `await recurse(...)` from playwright-utils for polling eventual-consistency conditions

### Isolation

- Each E2E spec runs in its own Playwright worker context (cookies, localStorage, IndexedDB).
- Shared `.auth/user.json` + `fullyParallel: true` means every parallel test authenticates as the same test user. **Tests that mutate user-scoped state** (classroom create/delete, behavior templates, sound settings) **MUST namespace data per test** (use `uniqueSlug()`) and clean up in `afterEach`/factory `cleanup()`. Otherwise parallel runs cross-pollute.
- Backend-integration tests share a Supabase instance across the run. If a test creates rows, it must delete them in `afterEach` or use unique-namespaced data.

### Cleanup discipline

- Every `afterEach` / `afterAll` / factory teardown that creates side effects (Supabase rows, timers, subscriptions, cookies) MUST undo them. Dangling rows in local Supabase cross-pollute parallel runs.
- Vitest unit `QueryClient` instances must be created fresh per test with `retry: false`. Don't share across tests.
- `vi.useFakeTimers()` requires explicit `vi.useRealTimers()` in cleanup. `vi.restoreAllMocks()` does NOT restore timer state.

---

## CI integration

`.github/workflows/test.yml` (existing) runs:

- `npm run lint`
- `npm run typecheck`
- `npm run check:bundle` (NFR4 devtools-DCE assertion after `npm run build`)
- `npm run test:e2e` sharded across 4 workers (`--shard=N/4`)
- An E2E burn-in job that runs the suite ≥2× to catch flake

**`npm test` (Vitest unit) and `npm run test:integration` (Vitest backend-integration) are not yet in CI** — both run on developer machines today. Adding them is a tracked future addition (see PRD).

### Adding the integration suite to CI later

The integration suite has the same security boundary as E2E (rejects non-private hosts), so the same `.env.test` setup applies. A minimal CI step:

```yaml
- name: Backend integration tests
  run: npm run test:integration
  env:
    # populate .env.test from CI secrets, then run
    VITE_SUPABASE_URL: http://127.0.0.1:54321
    VITE_SUPABASE_ANON_KEY: ${{ secrets.LOCAL_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.LOCAL_SERVICE_ROLE_KEY }}
```

(Both keys are non-secret for the pinned local stack — they're deterministic outputs of `npx supabase start`.)

---

## Knowledge base references

This scaffold was built from `@seontechnologies/playwright-utils` patterns, codified in the BMAD TEA knowledge fragments at `.claude/skills/bmad-testarch-framework/resources/knowledge/`:

- `overview.md` — playwright-utils install, design, functional-core/fixture-shell rationale
- `fixtures-composition.md` — `mergeTests` patterns, custom-fixture extension, overrides
- `data-factories.md` — factories with overrides, cleanup tracking, parallel safety
- `auth-session.md` — token-auth pattern (NOT used here; storageState is project convention)
- `network-first.md` — intercept-before-navigate workflow, deterministic waits
- `playwright-config.md` — env switching, timeout standards, artifact policy

---

## Troubleshooting

| Symptom                                                                    | Likely cause                                                                                         | Fix                                                                                                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E refuses to run against ...` at startup                                | Shell has leaked `VITE_SUPABASE_URL` from a prior `fnox exec --` session, AND `.env.test` is missing | Open a new shell, OR `unset VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY`, OR ensure `.env.test` exists with local values                              |
| `Failed to seed test user ...: ... already exists`                         | Stack was started, test user already seeded                                                          | This is idempotent — should pass silently. If it doesn't, ensure `seedTestUser` regex matches your Supabase version's "already registered" message |
| Browser tests time out at `Welcome Back` heading                           | Vite dev server didn't start (port collision, build error)                                           | Check `playwright-report/index.html` for the page screenshot; check the test stderr for vite errors                                                |
| `supabaseAdmin() requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY` | `.env.test` is missing or doesn't have the service-role key                                          | Re-run `npx supabase status` and copy the keys                                                                                                     |
| `npm test` errors loading `e2e.legacy/*.spec.ts`                           | A leftover legacy directory is being picked up by Vitest                                             | Already excluded in `vitest.config.ts` — if you see this, the exclude isn't matching; check the path matches the glob `**/e2e.legacy/**`           |

---

## Open follow-ups

These were surfaced during scaffold but require user decisions:

1. **`e2e.legacy/` and `playwright-legacy-config.ts` retirement.** Both predate this scaffold and exist at the project root. They're excluded from Vitest's unit run so they don't break `npm test`, but they otherwise sit dormant. Decision needed: move to `~/Backups/`, delete, or leave indefinitely.

2. **Add backend-integration tests beyond the smoke samples.** RLS policy assertions are the highest-value missing surface — write tests as different users (impersonation via service-role key) and assert can/can't see other users' data. The `public.classrooms` migration adds `user_id` for ownership; that's the natural first target.

3. **Wire `tdd-guard-vitest`.** It's installed (`devDependencies`) but not in `vitest.config.ts` `reporters`. Decide whether to enable it in pre-commit or CI.

4. **Add a `tests:all` aggregate script.** A single `npm run tests:all` that runs unit + integration + E2E in sequence would simplify CI parity. Not added by default — kept granular for now.
