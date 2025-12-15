# CI/CD Pipeline Documentation

ClassPoints uses GitHub Actions for continuous integration with automated testing, linting, and flaky test detection.

## Pipeline Overview

```
┌─────────────┐     ┌─────────────────────────────┐
│    Push     │────▶│         Lint Job            │
│   or PR     │     │  ESLint + TypeScript Check  │
└─────────────┘     └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │  Test Shard 1   │  │  Test Shard 2   │  │  Burn-in Loop   │
    │  (E2E tests)    │  │  (E2E tests)    │  │ (10 iterations) │
    └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
              │                    │                    │
              └────────────┬───────┘                    │
                           │                           │
                           ▼                           │
                 ┌─────────────────┐                   │
                 │  Test Summary   │◀──────────────────┘
                 └─────────────────┘
```

## Jobs

### 1. Lint & Type Check

- **Runs on:** Every push and PR
- **Duration:** ~1-2 minutes
- **Tasks:**
  - ESLint code quality checks
  - TypeScript type checking

### 2. E2E Tests (Sharded)

- **Runs on:** After lint passes
- **Shards:** 4 parallel jobs
- **Duration:** ~5-10 minutes per shard
- **Features:**
  - Automatic retry (2 attempts) for transient failures
  - Playwright browser caching
  - Failure artifacts uploaded (traces, screenshots, reports)

### 3. Burn-in Loop

- **Runs on:** Pull requests and weekly schedule (Monday 6am UTC)
- **Iterations:** 10 times
- **Purpose:** Detect flaky tests before merge
- **Duration:** ~20-30 minutes

### 4. Test Summary

- **Purpose:** Single status check for branch protection
- **Reports:** Pass/fail based on lint + test results

## Triggers

| Event        | Branches              | Jobs |
| ------------ | --------------------- | ---- |
| Push         | `main`, `develop`     | All  |
| Pull Request | `main`, `develop`     | All  |
| Schedule     | Weekly Monday 6am UTC | All  |

## Caching

The pipeline uses aggressive caching for fast execution:

1. **npm dependencies** - Built-in `actions/setup-node` cache
2. **Playwright browsers** - Custom cache with fallback keys
   - Skip full install when cache hit
   - Only install system deps on cache hit

## Running Locally

Mirror the CI pipeline locally before pushing:

```bash
# Full pipeline (lint → test → burn-in)
./scripts/ci-local.sh

# Quick selective tests (changed files only)
./scripts/test-changed.sh

# Standalone burn-in (10 iterations default)
./scripts/burn-in.sh

# Custom iterations
./scripts/burn-in.sh 5
```

## Debugging Failed CI

### 1. Download Artifacts

- Go to the failed workflow run
- Download `test-results-shard-N` or `burn-in-failures` artifact
- Extract and view `playwright-report/index.html`

### 2. View Traces

```bash
npx playwright show-trace path/to/trace.zip
```

### 3. Reproduce Locally

```bash
# Run the exact same test
npm run test:e2e -- --grep "test name"

# Or run full local CI
./scripts/ci-local.sh
```

### 4. Common Issues

| Issue                          | Solution                                                |
| ------------------------------ | ------------------------------------------------------- |
| Tests pass locally, fail in CI | Check for race conditions, use `./scripts/burn-in.sh`   |
| Timeout errors                 | Increase timeout in `playwright.config.ts`              |
| Cache miss                     | Check `package-lock.json` changes                       |
| Secrets not available          | Verify `DOTENV_PRIVATE_KEY_LOCAL` in repository secrets |

## Performance Targets

| Stage            | Target  | Actual     |
| ---------------- | ------- | ---------- |
| Lint             | <2 min  | ~1 min     |
| Test (per shard) | <10 min | ~5-8 min   |
| Burn-in          | <30 min | ~20-25 min |
| **Total**        | <45 min | ~30-35 min |

## Branch Protection

Configure these settings in GitHub repository settings:

1. Go to **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Enable:
   - [x] Require status checks to pass before merging
   - [x] Require branches to be up to date before merging
4. Status checks:
   - `Test Summary`
   - `Lint & Type Check`

## Badge

Add to README.md:

```markdown
[![Test Pipeline](https://github.com/Sallvainian/ClassPoints/actions/workflows/test.yml/badge.svg)](https://github.com/Sallvainian/ClassPoints/actions/workflows/test.yml)
```

## Related Files

- `.github/workflows/test.yml` - Pipeline configuration
- `.nvmrc` - Node version (22)
- `playwright.config.ts` - Test framework config
- `scripts/ci-local.sh` - Local CI mirror
- `scripts/burn-in.sh` - Flaky test detection
- `scripts/test-changed.sh` - Selective testing
