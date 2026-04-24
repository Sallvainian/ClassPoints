# ClassPoints E2E Tests

Playwright test suite for the ClassPoints React app. Unit/component tests live in `src/**` and are run by Vitest — see the top-level `CLAUDE.md`.

## Setup

E2E tests **must** run against a local Supabase stack. The Playwright config fail-closes against any non-private host (loopback, RFC1918, Tailscale CGNAT).

```bash
# One-time
npx supabase start                         # boots Postgres/Realtime/Auth on 127.0.0.1
cp .env.test.example .env.test             # fill in anon + service-role keys from `npx supabase status`
npx playwright install --with-deps         # install browser binaries

# Per-run
npm run test:seed                          # create the test user in local auth
npm run test:e2e                           # run against the local stack
```

If your shell has `VITE_SUPABASE_URL` exported (e.g. from a prior `fnox`-wrapped session), the config will refuse to run — `unset VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY` first, or run tests in a fresh shell.

## Running Tests

| Command                                         | Purpose                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| `npm run test:e2e`                              | Full suite against the local stack                    |
| `npm run test:e2e:local`                        | Seeds the test user, then runs the suite              |
| `npm run test:e2e:ui`                           | Playwright UI mode (interactive picker + time-travel) |
| `npx playwright test --headed`                  | Run with a visible browser                            |
| `npx playwright test --debug`                   | Open Playwright Inspector and step through            |
| `npx playwright test tests/e2e/example.spec.ts` | Single file                                           |
| `npx playwright show-report playwright-report`  | View last HTML report                                 |

## Directory Layout

```
tests/
├── e2e/                          # spec files (*.spec.ts)
│   └── example.spec.ts
└── support/
    ├── fixtures/
    │   ├── index.ts              # merged `test` export used by all specs
    │   └── factories/
    │       └── user.factory.ts   # seeded-user lifecycle + auto-cleanup
    ├── helpers/
    │   ├── supabase-admin.ts     # admin client (service-role)
    │   └── auth.ts               # UI-login fallback
    └── page-objects/             # (empty; add page objects as needed)
```

## Architecture

### Fixtures (`tests/support/fixtures/index.ts`)

All specs import `{ test, expect }` from `tests/support/fixtures`. This exports a `mergeTests`-composed Playwright test that adds three `@seontechnologies/playwright-utils` fixtures plus a local factory fixture:

- `log` — structured logging that attaches to the HTML report
- `apiRequest` — typed request helper with status + JSON body
- `recurse` — polling utility for async conditions
- `userFactory` — creates seeded users via Supabase admin; auto-deletes on teardown

To add a fixture, either extend the merged `test` in `index.ts` or create a separate fixture module and `mergeTests(..., yourFixture)` with it.

**`networkErrorMonitor` is available but not enabled by default** — Supabase realtime + storage endpoints regularly return expected 4xx responses that would break tests. To enable, add `createNetworkErrorMonitorFixture({ excludePatterns: [...] })` to the `mergeTests` call in `index.ts`.

### Data Factories (`tests/support/fixtures/factories/`)

Factories track created records and expose a `cleanup()` method. `UserFactory` is wired into the `userFactory` fixture so cleanup runs automatically in fixture teardown. New factories should follow the same pattern: create via admin client, push the id into an internal list, delete all in `cleanup()`.

### Helpers (`tests/support/helpers/`)

- `supabase-admin.ts` — cached `SupabaseClient` using `SUPABASE_SERVICE_ROLE_KEY`. Throws a clear error if env vars are missing.
- `auth.ts` — `loginViaUi(page, credentials)` for specs that need a fresh login flow. Once the storageState setup-project is ported (see below), most specs should rely on `storageState` rather than this helper.

## Best Practices

- **Selectors:** prefer `data-testid` via `page.getByTestId('...')`. Fall back to role-based queries (`getByRole`) before text selectors.
- **Structure:** specs follow Given/When/Then. Comments stay light; let the test IDs and assertions carry the narrative.
- **Isolation:** never share state between specs. Use factories for any data the test creates, and let fixture teardown clean it up.
- **No hard waits:** use `expect(locator).toBeVisible()` or the `recurse` fixture for polling. Never `page.waitForTimeout(...)`.
- **Network:** no manual mocking in the initial scaffold. If a spec needs to stub responses, use `@seontechnologies/playwright-utils/intercept-network-call` and register the intercept **before** `page.goto(...)`.
- **Artifacts:** traces, screenshots, and videos retain only on failure. Don't enable them globally — the `playwright-report/` artifact will balloon.

## CI Integration

`playwright.config.ts` already tunes for CI: `retries: 2`, `workers: 1`, `forbidOnly: true` when `process.env.CI` is truthy. The HTML reporter writes to `playwright-report/`, JUnit to `playwright-report/junit.xml`.

Typical GitHub Actions flow:

1. Start a local Supabase stack (`supabase/setup-cli` + `npx supabase start`).
2. Install dependencies (`npm ci`) and browsers (`npx playwright install --with-deps chromium`).
3. Seed the test user (`npm run test:seed`).
4. Run `npx playwright test` (or `npm run test:e2e`).
5. Upload `playwright-report/` on failure.

## TODO (user follow-ups)

These were deliberately left out of the initial scaffold and need a manual pass:

1. **Port the `auth.setup.ts` storageState pattern** from `playwright-legacy-config.ts`. Add a `setup` project to `playwright.config.ts` that runs `tests/auth.setup.ts`, sign in once, save to `.auth/user.json`, and have the `chromium` project depend on it with `storageState`. The legacy file (`playwright-legacy-config.ts` + `e2e.legacy/auth.setup.ts`) is a working reference.
2. **Retire `e2e.legacy/` and `playwright-legacy-config.ts`** once the relevant specs have been ported into `tests/e2e/`.
3. **Decide on `networkErrorMonitor`** — enable with a curated `excludePatterns` list, or leave off.

## Knowledge base references

- `@seontechnologies/playwright-utils` — README in `node_modules/@seontechnologies/playwright-utils/`
- Playwright docs — https://playwright.dev/docs/intro
- Top-level CLAUDE.md — project-wide testing conventions and the local-Supabase invariant

## Troubleshooting

**"E2E refuses to run against \<host\>"** — `VITE_SUPABASE_URL` is not a private host. Either your `.env.test` isn't pointing at `127.0.0.1:54321`, or a shell-exported var is shadowing it. `unset VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY` and retry.

**"supabaseAdmin() requires ... SUPABASE_SERVICE_ROLE_KEY"** — `.env.test` is missing the service-role key. Paste it from `npx supabase status` output.

**Tests hang at `webServer`** — Vite didn't boot. Check that `npm run dev` works standalone first; `fnox` needs to be on PATH to decrypt the age secrets.

**Factory cleanup fails mid-run** — orphaned users accumulate in local auth. `npx supabase db reset` wipes the local database; re-run `npm run test:seed` after.
