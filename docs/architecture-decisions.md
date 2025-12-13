---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/prd.md
  - docs/index.md
  - docs/architecture.md
documentCounts:
  prd: 1
  epics: 0
  ux: 0
  research: 0
  projectDocs: 2
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2025-12-13'
project_name: 'ClassPoints'
user_name: 'Sallvain'
date: '2025-12-13'
hasExistingArchitecture: true
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
24 requirements focused on developer experience infrastructure:

- **Code Quality (FR1-FR11):** Automated formatting, linting, and type safety
- **Git Workflow (FR12-FR14):** Pre-commit validation with escape hatch
- **Documentation (FR15-FR21):** CLAUDE.md + modular `.claude/rules/` system
- **DX (FR22-FR24):** Single-command setup, zero manual intervention

**Non-Functional Requirements:**
12 requirements establishing quality gates:

- Pre-commit hooks complete in <10 seconds
- Full lint check in <30 seconds
- TypeScript check in <60 seconds
- New developer setup in <5 minutes

**Scale & Complexity:**

- Primary domain: Developer Experience / Tooling
- Complexity level: Low
- Estimated architectural components: Minimal (configuration-focused)

### Technical Constraints & Dependencies

- **Existing codebase:** React 18 + TypeScript + Vite + Supabase stack unchanged
- **Existing architecture:** Context-based state management preserved
- **Tooling stack:** Prettier, ESLint, TypeScript, Husky/lint-staged (or similar)
- **CI/CD alignment:** Local and pipeline validation must match

### Cross-Cutting Concerns Identified

1. **Pattern Enforcement:** Git hooks + CI must enforce same rules
2. **Documentation Currency:** CLAUDE.md must stay synchronized with actual patterns
3. **TypeScript Strict Migration:** May reveal errors requiring incremental fixes
4. **AI Agent Consistency:** Claude rules must provide unambiguous guidance

## Tooling Architecture Decisions (Brownfield Adaptation)

_Since ClassPoints is an existing brownfield project, "Starter Template" evaluation was adapted to focus on tooling architecture decisions for the DX initiative._

### ADR-001: Git Hooks Tooling

**Status:** Decided

**Context:** Need pre-commit validation for formatting, linting, and type checking per FR12-FR14.

**Options Considered:**

| Option              | Pros                                                   | Cons                                  |
| ------------------- | ------------------------------------------------------ | ------------------------------------- |
| Husky + lint-staged | Industry standard, excellent docs, huge ecosystem      | ~50 dependencies, heavier than needed |
| simple-git-hooks    | Zero dependencies, minimal, does exactly what's needed | Smaller ecosystem, fewer tutorials    |
| lefthook            | Parallel execution, fastest                            | Overkill for small/solo project       |

**Decision:** `simple-git-hooks`

**Rationale:** Zero dependencies means less maintenance burden. The project is solo/small and doesn't need Husky's ecosystem or lefthook's parallelism. Simplicity wins for this scope.

---

### ADR-002: ESLint Configuration Format

**Status:** Decided

**Context:** ESLint 9 introduced flat config; need to choose configuration approach.

**Options Considered:**

| Option                         | Pros                        | Cons                                |
| ------------------------------ | --------------------------- | ----------------------------------- |
| Flat config (eslint.config.js) | Future-proof, modern        | Plugin compatibility still maturing |
| Legacy (.eslintrc)             | Mature ecosystem, best docs | Deprecated long-term                |
| Flat + compat layer            | Best of both                | Highest complexity                  |

**Decision:** `Legacy (.eslintrc)`

**Rationale:** This is a technical debt remediation project, not greenfield. Stability and troubleshooting ease matter more than being on the bleeding edge. Flat config migration can be a separate initiative later.

---

### ADR-003: TypeScript Strict Mode Strategy

**Status:** Decided

**Context:** PRD requires strict mode enabled with all errors resolved (FR8-FR11).

**Options Considered:**

| Option                          | Pros                  | Cons                   |
| ------------------------------- | --------------------- | ---------------------- |
| Enable all strict flags at once | Clean result, no debt | Higher initial effort  |
| Progressive flag enablement     | Less overwhelming     | Longer timeline        |
| Suppress + track errors         | Ships fastest         | Creates technical debt |

**Decision:** `Enable strict: true all at once`

**Rationale:** The codebase is small (29 components, 9 hooks). The initial effort to fix all errors is worth having zero suppressions or technical debt to track. Rip the band-aid off.

---

### ADR-004: Pattern Documentation Structure

**Status:** Decided

**Context:** FR15-FR21 require CLAUDE.md and modular rules system for AI agent consistency.

**Options Considered:**

| Option                      | Pros                    | Cons                            |
| --------------------------- | ----------------------- | ------------------------------- |
| Everything in CLAUDE.md     | Single source of truth  | Context pollution, overwhelming |
| Fully modular rules/ only   | Targeted loading        | Hard to discover, fragmented    |
| Hybrid (CLAUDE.md + rules/) | Targeted + discoverable | Slight complexity               |

**Decision:** `Hybrid approach`

**Rationale:** CLAUDE.md contains project overview and key patterns. `.claude/rules/` contains deep dives for components, hooks, contexts, etc. This matches PRD requirements and reduces context pollution for AI agents.

---

### Tooling Architecture Summary

| Decision      | Choice                      | Key Rationale                          |
| ------------- | --------------------------- | -------------------------------------- |
| Git Hooks     | `simple-git-hooks`          | Zero deps, minimal, sufficient         |
| ESLint Config | Legacy `.eslintrc`          | Stability for remediation project      |
| TypeScript    | Enable `strict: true` fully | Small codebase, worth the effort       |
| Documentation | Hybrid CLAUDE.md + rules/   | Matches PRD, reduces context pollution |

## Development Workflow Decisions

### ADR-005: Prettier Configuration Strategy

**Status:** Decided

**Decision:** `Minimal Customization`

**Rationale:** A small `.prettierrc` sets essentials (indentation, quotes, line length) without overthinking every option. Balances consistency with low maintenance.

---

### ADR-006: ESLint Plugin Set

**Status:** Decided

**Decision:** `Standard` - Keep existing setup

**Plugins:**

- `eslint:recommended`
- `@typescript-eslint/recommended`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`

**Rationale:** Standard set catches real bugs (like missing hook dependencies) without adding noise from import ordering or accessibility rules during remediation.

---

### ADR-007: CI Pipeline Strategy

**Status:** Decided

**Decision:** `Expanded` - CI runs local checks + full test suite + build verification

**CI Should Run:**

1. `npm run lint` (same as local)
2. `npm run typecheck` (same as local)
3. `npm run test` (full test suite)
4. `npm run build` (verify production build)

**Rationale:** Catches issues that slip through local (environment differences, bypassed hooks) while maintaining alignment with local validation.

---

### ADR-008: Claude Rules File Structure

**Status:** Decided

**Decision:** `By File Type`

**Planned Files:**

- `.claude/rules/components.md` - Component patterns and conventions
- `.claude/rules/hooks.md` - Hook patterns and naming
- `.claude/rules/contexts.md` - Context/state management patterns
- `.claude/rules/utils.md` - Utility function patterns
- `.claude/rules/testing.md` - Test file patterns

**Rationale:** Matches Claude Code's path-based rules loading. Editing a component loads component rules, editing a hook loads hook rules.

---

### Development Workflow Summary

| Decision        | Choice                | Key Rationale                    |
| --------------- | --------------------- | -------------------------------- |
| Prettier Config | Minimal Customization | Essentials only, low maintenance |
| ESLint Plugins  | Standard              | Real bug catching, no noise      |
| CI Pipeline     | Expanded              | Local + tests + build            |
| Rules Structure | By File Type          | Matches path-based loading       |

## DX Tooling Patterns

_These patterns govern the new tooling infrastructure being added to the project._

### Pre-Commit Hook Behavior

**Hook Sequence:**

1. `prettier --write` on staged files
2. `eslint` on staged files
3. `tsc --noEmit` on entire project

**On Failure:** Commit rejected with clear error output. Fix issues, re-stage, re-commit.

**Emergency Bypass:** `git commit --no-verify` (use sparingly - CI will still validate)

---

### Rules File Format

**Location:** `.claude/rules/{type}.md`

**Required Sections:**

- **Applies to:** glob pattern for target files
- **Naming Conventions:** specific naming rules
- **Structure Pattern:** expected file structure
- **Required Patterns:** must-follow patterns
- **Anti-Patterns:** what to avoid
- **Examples:** good and bad code samples

---

### Error Handling Patterns

**Linting Errors:**

- Fix file-by-file during remediation
- Zero `eslint-disable` comments unless justified
- Zero warnings policy post-remediation

**TypeScript Strict Errors:**

- Add explicit types (no implicit any)
- Handle null cases explicitly (no `!` unless proven safe)
- No `@ts-ignore` for fixable issues

---

### Documentation Currency

**Update CLAUDE.md when:**

- Adding new component/hook patterns
- Changing architectural approaches
- Discovering new gotchas

**Update .claude/rules/ when:**

- Adding file-type-specific patterns
- Documenting complex examples
- Recording anti-patterns

**PR Checklist:** "Does this change require documentation update?"

## Project Structure for DX Initiative

_Since ClassPoints is a brownfield project, this section documents the NEW files being added rather than the existing structure._

### New Files to Create

| File                          | Purpose                          | ADR Reference |
| ----------------------------- | -------------------------------- | ------------- |
| `.prettierrc`                 | Minimal Prettier config          | ADR-005       |
| `.claude/rules/components.md` | Component patterns for AI agents | ADR-008       |
| `.claude/rules/hooks.md`      | Hook patterns for AI agents      | ADR-008       |
| `.claude/rules/contexts.md`   | Context patterns for AI agents   | ADR-008       |
| `.claude/rules/utils.md`      | Utility patterns for AI agents   | ADR-008       |
| `.claude/rules/testing.md`    | Test patterns for AI agents      | ADR-008       |

### Files to Update

| File                       | Change                      | ADR Reference    |
| -------------------------- | --------------------------- | ---------------- |
| `package.json`             | Add simple-git-hooks config | ADR-001          |
| `.eslintrc.json`           | Verify/standardize config   | ADR-002, ADR-006 |
| `tsconfig.json`            | Enable strict mode          | ADR-003          |
| `.github/workflows/ci.yml` | Expand pipeline             | ADR-007          |

### Rules File Structure

```
.claude/rules/
├── components.md    # Applies to: src/components/**/*.tsx
├── hooks.md         # Applies to: src/hooks/**/*.ts
├── contexts.md      # Applies to: src/contexts/**/*.tsx
├── utils.md         # Applies to: src/utils/**/*.ts
└── testing.md       # Applies to: **/*.test.ts, e2e/**/*.ts
```

### Requirements to Files Mapping

| PRD Requirement           | Implemented By                     |
| ------------------------- | ---------------------------------- |
| FR1-FR3 (Formatting)      | `.prettierrc` + pre-commit hook    |
| FR4-FR7 (Linting)         | `.eslintrc.json` + pre-commit hook |
| FR8-FR11 (Type Safety)    | `tsconfig.json` strict mode        |
| FR12-FR14 (Git Workflow)  | `package.json` simple-git-hooks    |
| FR15-FR21 (Documentation) | CLAUDE.md + `.claude/rules/*.md`   |
| FR22-FR24 (DX)            | All above + `npm install` setup    |

## Architecture Validation Results

### Coherence Validation ✅

All 8 ADRs are internally consistent and compatible with each other.
No contradictory decisions or patterns found.

- simple-git-hooks + Prettier + ESLint work together seamlessly
- Legacy ESLint config has full React plugin support
- TypeScript strict mode is manageable for this codebase size
- Hybrid documentation approach complements rules-by-file-type

### Requirements Coverage ✅

| Category                                 | Coverage |
| ---------------------------------------- | -------- |
| Functional Requirements (FR1-FR24)       | 100%     |
| Non-Functional Requirements (NFR1-NFR12) | 100%     |

All 24 functional requirements and 12 non-functional requirements are addressed by the architectural decisions.

### Implementation Readiness ✅

- **Decisions:** 8 ADRs with clear rationale
- **Patterns:** 5 DX tooling patterns defined
- **Structure:** 6 new files, 4 updates mapped

### Architecture Completeness Checklist

- [x] Project context analyzed (brownfield DX initiative)
- [x] Technical constraints identified (existing React/Supabase stack)
- [x] All critical decisions documented (8 ADRs)
- [x] Implementation patterns defined (5 DX patterns)
- [x] Project structure mapped (6 new files, 4 updates)
- [x] Requirements fully covered (100%)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**

- Clear, focused scope (DX tooling only)
- Minimal dependencies (simple-git-hooks has zero deps)
- Builds on existing documented patterns

**First Implementation Priority:**

1. Install `simple-git-hooks` and configure in `package.json`
2. Create `.prettierrc` with minimal config
3. Enable TypeScript `strict: true` and fix errors
4. Create `.claude/rules/*.md` files
5. Update CI pipeline for expanded validation

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2025-12-13
**Document Location:** docs/architecture-decisions.md

### Final Architecture Deliverables

**📋 Complete Architecture Document**

- 8 architectural decisions documented with rationale
- 5 implementation patterns ensuring AI agent consistency
- Complete project structure with files to create/update
- Requirements to architecture mapping (100% coverage)
- Validation confirming coherence and completeness

**🏗️ Implementation Ready Foundation**

- All decisions made for DX tooling initiative
- Patterns defined for pre-commit, rules files, error handling, documentation
- Clear mapping from PRD requirements to implementation files

### Implementation Handoff

**For AI Agents:**
This architecture document is your complete guide for implementing the ClassPoints DX initiative. Follow all decisions, patterns, and structures exactly as documented.

**Development Sequence:**

1. Install `simple-git-hooks` and configure in `package.json`
2. Create `.prettierrc` with minimal config
3. Enable TypeScript `strict: true` and fix all errors
4. Create `.claude/rules/*.md` files (components, hooks, contexts, utils, testing)
5. Update CI pipeline for expanded validation

### Quality Assurance Checklist

**✅ Architecture Coherence**

- [x] All 8 ADRs work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**

- [x] All 24 functional requirements are supported
- [x] All 12 non-functional requirements are addressed
- [x] Cross-cutting concerns are handled

**✅ Implementation Readiness**

- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.
