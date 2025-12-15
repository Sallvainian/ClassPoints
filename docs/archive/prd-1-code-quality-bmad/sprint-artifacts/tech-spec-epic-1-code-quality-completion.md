# Tech-Spec: Epic 1 - Automated Code Quality Foundation (Completion)

**Created:** 2025-12-14
**Status:** Ready for Development
**Epic:** Epic 1 - Automated Code Quality Foundation
**Estimated Effort:** Small (most work already done)

## Overview

### Problem Statement

Epic 1 aims to establish automated code quality tooling so developers can write code knowing it will be automatically formatted and linted. Investigation reveals that **most of this work is already complete**, but there are gaps in the npm scripts, VS Code configuration, and documentation that prevent the epic from being fully "done."

### Solution

Complete the remaining gaps to achieve full Epic 1 acceptance criteria:

1. Add missing `npm run format` and `npm run format:check` scripts
2. Create `.vscode/settings.json` for format-on-save
3. Add `.prettierignore` to match ESLint ignores
4. Update README with tooling documentation
5. Verify all acceptance criteria pass

### Scope

**In Scope:**

- Adding 2 npm scripts for Prettier
- Creating VS Code workspace settings
- Creating `.prettierignore` file
- Documenting tooling in README
- Verifying all acceptance criteria

**Out of Scope:**

- Changing existing ESLint configuration
- Switching from simple-git-hooks to Husky (current setup works)
- Modifying TypeScript configuration
- Fixing the 7 lint warnings (they're informational, not errors)

## Context for Development

### Current State Analysis

| Component         | Status     | Notes                                    |
| ----------------- | ---------- | ---------------------------------------- |
| Prettier          | Installed  | v3.7.4, `.prettierrc` configured         |
| ESLint            | Configured | v9.17.0, TypeScript-aware, React plugins |
| Pre-commit        | Working    | `simple-git-hooks` + `lint-staged`       |
| TypeScript Strict | Enabled    | `"strict": true` in tsconfig.app.json    |
| Type Errors       | None       | `npm run typecheck` passes               |
| Lint Errors       | None       | 7 warnings only (not blocking)           |

### Codebase Patterns

**Package.json scripts pattern:**

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

**ESLint ignores pattern (from eslint.config.js):**

```javascript
ignores: [
  'dist',
  'dist-ssr',
  '.bmad',
  '.claude',
  '.agent',
  '.cursor',
  '.serena',
  'node_modules',
  '*.config.js',
  '*.config.ts',
  'supabase',
  'scripts',
  'coverage',
];
```

### Files to Reference

| File               | Purpose                       |
| ------------------ | ----------------------------- |
| `package.json`     | Add format scripts            |
| `.prettierrc`      | Existing Prettier config      |
| `eslint.config.js` | Reference for ignore patterns |
| `README.md`        | Add tooling documentation     |

### Technical Decisions

1. **Use `simple-git-hooks` (not Husky)** - Already configured and working; no need to change
2. **Match Prettier ignores to ESLint ignores** - Consistency across tools
3. **VS Code as primary editor** - Project already has VS Code-specific configs in CLAUDE.md

## Implementation Plan

### Tasks

- [ ] Task 1: Add `npm run format` script to package.json
  - Script: `"format": "prettier --write ."`

- [ ] Task 2: Add `npm run format:check` script to package.json
  - Script: `"format:check": "prettier --check ."`

- [ ] Task 3: Create `.prettierignore` file
  - Match the ignore patterns from `eslint.config.js`

- [ ] Task 4: Create `.vscode/settings.json` for format-on-save
  - Enable `editor.formatOnSave`
  - Set default formatter to Prettier
  - Configure ESLint auto-fix on save

- [ ] Task 5: Update README.md with tooling documentation
  - Document npm scripts
  - Document pre-commit hooks
  - Document VS Code setup

- [ ] Task 6: Verify all Story 1.1-1.4 acceptance criteria pass
  - Run through each AC manually
  - Document any remaining issues

### Acceptance Criteria

**From Story 1.1 (Prettier):**

- [x] Given I save a file in VS Code, Then the file is automatically formatted _(requires Task 4)_
- [ ] Given I run `npm run format`, Then all files are formatted _(requires Task 1)_
- [ ] Given I run `npm run format:check`, Then command exits non-zero if issues exist _(requires Task 2)_

**From Story 1.2 (ESLint):**

- [x] Given I open a file with linting issues, Then I see inline error highlighting
- [x] Given I run `npm run lint`, Then all issues are listed with file locations
- [x] Given I check ESLint config, Then I can see which rules are enabled

**From Story 1.3 (Pre-commit):**

- [x] Given I commit, Then Prettier and ESLint run on staged files
- [x] Given lint errors exist, Then commit is rejected with clear message
- [x] Given I use `git commit --no-verify`, Then hooks are bypassed
- [x] Given typical commit, Then hooks complete under 10 seconds

**From Story 1.4 (DX):**

- [x] Given I run `npm install`, Then hooks are automatically configured
- [x] Given I encounter an error, Then message tells me how to fix it
- [ ] Given I'm a new developer, Then README documents setup _(requires Task 5)_

## Additional Context

### Dependencies

- All dependencies already installed
- No new packages required

### Testing Strategy

**Manual verification:**

1. Run `npm run format` and verify files are formatted
2. Run `npm run format:check` on a file with bad formatting, verify non-zero exit
3. Open VS Code, save a file, verify format-on-save works
4. Make a commit with lint errors, verify rejection
5. Time a typical commit, verify under 10 seconds

**No automated tests needed** - this is tooling configuration, not application code.

### Notes

**Why simple-git-hooks instead of Husky?**
The project already uses `simple-git-hooks` which works identically to Husky for this use case. The Epic 1 stories mention "Husky" but the intent (pre-commit hooks) is satisfied by the current implementation. No migration needed.

**Lint warnings:**
The 7 `react-refresh/only-export-components` warnings are informational. They suggest splitting exports but don't indicate bugs. These can be addressed in a future cleanup but don't block Epic 1 completion.

---

## Files to Create/Modify

### 1. package.json (modify)

Add to `scripts`:

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

### 2. .prettierignore (create)

```
# Build output
dist
dist-ssr

# AI tooling folders
.bmad
.claude
.agent
.cursor
.serena

# Dependencies
node_modules

# Generated/config
*.config.js
*.config.ts

# Supabase
supabase

# Scripts
scripts

# Coverage
coverage

# Misc
.git
```

### 3. .vscode/settings.json (create)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### 4. README.md (modify)

Add section:

```markdown
## Development Tooling

### Code Quality Tools

This project uses automated code quality tools:

- **Prettier** - Code formatting
- **ESLint** - Code linting with TypeScript support
- **Pre-commit hooks** - Automatic validation before commits

### Available Scripts

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `npm run lint`         | Check for linting issues         |
| `npm run format`       | Format all files                 |
| `npm run format:check` | Check formatting without writing |
| `npm run typecheck`    | Run TypeScript type checking     |

### Pre-commit Hooks

Pre-commit hooks run automatically on every commit:

1. Prettier formats staged files
2. ESLint checks and auto-fixes staged files
3. TypeScript type-checks the project

If any check fails, the commit is rejected with an error message.

**Emergency bypass:** `git commit --no-verify` (use sparingly)

### VS Code Setup

1. Install the **Prettier** extension (`esbenp.prettier-vscode`)
2. Install the **ESLint** extension (`dbaeumer.vscode-eslint`)
3. Project settings in `.vscode/settings.json` enable format-on-save
```
