```markdown
# ClassPoints Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill introduces the core development patterns and workflows used in the **ClassPoints** repository, a React project written in TypeScript. You'll learn the project's coding conventions, commit message style, testing approach, and how to execute key documentation workflows using suggested commands.

---

## Coding Conventions

### File Naming

- **Style:** kebab-case
- **Example:**  
  ```
  user-profile.tsx
  class-points-list.ts
  ```

### Import Style

- **Style:** Relative imports
- **Example:**
  ```typescript
  import UserProfile from './user-profile';
  import { calculatePoints } from '../utils/points';
  ```

### Export Style

- **Style:** Default exports
- **Example:**
  ```typescript
  // user-profile.tsx
  const UserProfile = () => { /* ... */ };
  export default UserProfile;
  ```

### Commit Messages

- **Pattern:** Conventional commits
- **Prefixes Used:** `docs`, `feat`
- **Format Example:**
  ```
  feat: add leaderboard component
  docs: update architecture documentation
  ```
- **Average Length:** ~50 characters

---

## Workflows

### Refresh Project Context Documentation

**Trigger:** When you need to update the project context and architecture documentation to reflect recent codebase changes.

**Command:** `/refresh-context-docs`

**Steps:**
1. Run project scan tooling to generate updated documentation files.
2. Overwrite or update docs such as `architecture.md`, `component-inventory.md`, `data-models.md`, etc.
3. Archive the previous project scan report under `docs/.archive/`.
4. Commit all updated and archived documentation files.

**Files Involved:**
- `docs/architecture.md`
- `docs/component-inventory.md`
- `docs/data-models.md`
- `docs/development-guide.md`
- `docs/index.md`
- `docs/project-overview.md`
- `docs/project-scan-report.json`
- `docs/source-tree-analysis.md`
- `docs/state-management.md`
- `docs/.archive/project-scan-report-*.json`

**Frequency:** ~2x/month

---

## Testing Patterns

- **Framework:** Unknown (not detected in analysis)
- **File Pattern:** Test files are named using `*.test.*`
  - Example: `user-profile.test.tsx`
- **Location:** Typically alongside the component or module being tested

---

## Commands

| Command                | Purpose                                                         |
|------------------------|-----------------------------------------------------------------|
| /refresh-context-docs  | Refresh and regenerate project context and architecture docs     |

---
```