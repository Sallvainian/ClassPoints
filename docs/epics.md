---
stepsCompleted:
  [
    'step-01-validate-prerequisites',
    'step-02-design-epics',
    'step-03-create-stories',
    'step-04-final-validation',
  ]
workflowComplete: true
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
  - docs/ux-design-specification/index.md
---

# ClassPoints - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for ClassPoints, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Code Formatting**

- FR1: Developers can have all code automatically formatted to a consistent style on save
- FR2: Developers can run a command to format all files in the project
- FR3: Developers can see formatting applied automatically before any commit

**Code Linting**

- FR4: Developers can see linting errors and warnings in real-time in their editor
- FR5: Developers can run a command to check all files for linting issues
- FR6: The system prevents commits that contain linting errors
- FR7: Developers can see which ESLint rules are configured and why

**Type Safety**

- FR8: TypeScript catches type errors before code is committed
- FR9: Developers can run a command to check all files for type errors
- FR10: The system uses strict TypeScript mode to catch more potential issues
- FR11: All existing type errors are resolved before MVP completion

**Git Workflow Automation**

- FR12: Pre-commit hooks automatically run formatting, linting, and type checks
- FR13: Commits that fail validation are rejected with clear error messages
- FR14: Developers can bypass hooks in emergency situations with explicit flag

**BMAD Workflow Integration**

- FR15: CLAUDE.md contains a "Development Workflow" section that maps task types to BMAD workflows
- FR16: Planning tasks (PRD, research, product briefs) are routed to /bmad:bmm:workflows commands
- FR17: Solutioning tasks (architecture, UX design, epics/stories) are routed to /bmad:bmm:workflows commands
- FR18: Implementation tasks require active sprint-status.yaml and use dev-story workflow
- FR19: Code review and retrospective tasks use corresponding BMAD workflows
- FR20: bmm-workflow-status.yaml must only be updated through proper BMAD workflows, not manually

**Developer Experience**

- FR21: Developers can set up the project with a single npm install command
- FR22: All tooling runs automatically without manual intervention during normal workflow
- FR23: Error messages from tooling are clear and actionable

### NonFunctional Requirements

**Tooling Performance**

- NFR1: Pre-commit hooks complete within 10 seconds for typical commits
- NFR2: Full project lint check completes within 30 seconds
- NFR3: TypeScript type checking completes within 60 seconds for full project

**Developer Experience Quality**

- NFR4: All error messages include actionable guidance on how to fix the issue
- NFR5: Tooling configuration is documented and easy to understand
- NFR6: New developers can set up the project in under 5 minutes

**Reliability**

- NFR7: Tooling works consistently across all developer machines
- NFR8: Pre-commit hooks don't fail due to environment differences
- NFR9: CI/CD pipeline validates the same rules as local development

### Additional Requirements

**From Architecture:**

- Hybrid Online/Offline Architecture must be preserved during refactoring
- Realtime subscriptions require proper cleanup to prevent memory leaks
- Row Level Security (RLS) must remain enabled on all database tables
- Context Provider hierarchy order must be maintained (Auth → AuthGuard → HybridApp → App)
- useApp() facade pattern must be enforced for component state access
- Optimistic UI updates with server reconciliation pattern must be preserved
- REPLICA IDENTITY FULL setting on tables must be maintained for DELETE payloads

**From UX Design:**

- WCAG 2.1 AA compliance is required for educational software
- Touch targets must be ≥44px for all interactive elements
- Text contrast must meet ≥4.5:1 (body), ≥3:1 (large text)
- All functions must be keyboard accessible
- Focus indicators must be visible (2px outline minimum)
- Smart Board-first responsive design (1920×1080 primary target)
- Calibrated Celebration animation pattern: 0.5-1.0s total, non-disruptive
- Reduced Motion preference support (future enhancement)
- Custom breakpoints: sb (≥1280px), lg (≥1024px), md (≥768px), sm (<768px)
- Critical components: StudentCard, BehaviorModal, PointBadge

### FR Coverage Map

| FR   | Epic   | Description                                 |
| ---- | ------ | ------------------------------------------- |
| FR1  | Epic 1 | Auto-format on save                         |
| FR2  | Epic 1 | Format all files command                    |
| FR3  | Epic 1 | Pre-commit formatting                       |
| FR4  | Epic 1 | Real-time linting in editor                 |
| FR5  | Epic 1 | Lint check command                          |
| FR6  | Epic 1 | Commits blocked on lint errors              |
| FR7  | Epic 1 | ESLint rules visibility                     |
| FR8  | Epic 2 | Type errors caught before commit            |
| FR9  | Epic 2 | Type check command                          |
| FR10 | Epic 2 | TypeScript strict mode                      |
| FR11 | Epic 2 | All type errors resolved                    |
| FR12 | Epic 1 | Pre-commit hooks automation                 |
| FR13 | Epic 1 | Clear rejection messages                    |
| FR14 | Epic 1 | Emergency bypass flag                       |
| FR15 | Epic 3 | CLAUDE.md workflow mapping section          |
| FR16 | Epic 3 | Planning tasks routed to BMAD               |
| FR17 | Epic 3 | Solutioning tasks routed to BMAD            |
| FR18 | Epic 3 | Implementation requires sprint-status.yaml  |
| FR19 | Epic 3 | Code review/retro use BMAD workflows        |
| FR20 | Epic 3 | bmm-workflow-status.yaml via workflows only |
| FR21 | Epic 1 | Single npm install setup                    |
| FR22 | Epic 1 | Automatic tooling workflow                  |
| FR23 | Epic 1 | Actionable error messages                   |

## Epic List

### Epic 1: Automated Code Quality Foundation

**User Outcome:** Developers can write code knowing it will be automatically formatted and linted, with immediate feedback in their editor and automatic validation before any commit reaches the repository.

**What users can do after this epic:**

- Write code with auto-format on save
- See linting issues in real-time
- Commit confidently knowing pre-commit hooks validate code
- Set up the project with a single `npm install`

**FRs Covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR12, FR13, FR14, FR21, FR22, FR23

**NFRs Addressed:** NFR1, NFR2, NFR4, NFR5, NFR6, NFR7, NFR8, NFR9

#### Story 1.1: Configure Prettier for Code Formatting

As a **developer**,
I want **Prettier configured with project-appropriate rules and format-on-save enabled**,
So that **my code is automatically formatted to a consistent style without manual intervention**.

**Acceptance Criteria:**

**Given** the project has Prettier installed and configured
**When** I save a file in VS Code
**Then** the file is automatically formatted according to project rules

**Given** I run `npm run format`
**When** files exist with inconsistent formatting
**Then** all files are formatted to project standards

**Given** I run `npm run format:check`
**When** any files have formatting issues
**Then** the command exits with a non-zero status and lists the affected files

**FRs Covered:** FR1, FR2

#### Story 1.2: Configure ESLint for Code Linting

As a **developer**,
I want **ESLint configured with TypeScript-aware rules and editor integration**,
So that **I see linting errors in real-time and can fix issues before committing**.

**Acceptance Criteria:**

**Given** the project has ESLint installed and configured
**When** I open a file with linting issues in VS Code
**Then** I see inline error highlighting and problems in the Problems panel

**Given** I run `npm run lint`
**When** there are linting issues in the codebase
**Then** the command lists all issues with file locations and rule names
**And** the command exits with a non-zero status if errors exist

**Given** I want to understand a rule
**When** I check the ESLint configuration
**Then** I can see which rules are enabled and find documentation for them

**FRs Covered:** FR4, FR5, FR7

#### Story 1.3: Configure Pre-commit Hooks with Husky

As a **developer**,
I want **pre-commit hooks that automatically run formatting and linting on staged files**,
So that **non-compliant code is caught before it reaches the repository**.

**Acceptance Criteria:**

**Given** I have staged changes to commit
**When** I run `git commit`
**Then** Prettier formats the staged files automatically
**And** ESLint checks the staged files for errors
**And** if there are lint errors, the commit is rejected with a clear error message

**Given** I have an emergency and need to bypass hooks
**When** I run `git commit --no-verify`
**Then** the commit proceeds without running hooks

**Given** the pre-commit hooks are running
**When** they complete on a typical commit (under 10 files)
**Then** the total hook execution time is under 10 seconds

**FRs Covered:** FR3, FR6, FR12, FR13, FR14
**NFRs Covered:** NFR1

#### Story 1.4: Verify Developer Experience and Documentation

As a **developer**,
I want **the project setup to be simple with clear error messages**,
So that **I can get started quickly and understand issues when they occur**.

**Acceptance Criteria:**

**Given** I clone the repository
**When** I run `npm install`
**Then** all development dependencies are installed
**And** git hooks are automatically configured via postinstall
**And** no additional setup steps are required

**Given** I encounter a lint or format error
**When** I read the error message
**Then** it tells me what's wrong and how to fix it

**Given** I'm a new developer
**When** I follow the README setup instructions
**Then** I can have the project running with tooling active in under 5 minutes

**FRs Covered:** FR21, FR22, FR23
**NFRs Covered:** NFR4, NFR5, NFR6

---

### Epic 2: Type-Safe Development Environment

**User Outcome:** Developers can make code changes confidently knowing TypeScript strict mode catches potential type errors before they're committed, with all existing type errors resolved.

**What users can do after this epic:**

- Work in a strict TypeScript environment
- See type errors caught before commit
- Trust the type system to catch mistakes
- Run type checking commands on the full project

**FRs Covered:** FR8, FR9, FR10, FR11

**NFRs Addressed:** NFR3, NFR4

#### Story 2.1: Enable TypeScript Strict Mode

As a **developer**,
I want **TypeScript configured in strict mode with appropriate compiler options**,
So that **the type system catches more potential issues before runtime**.

**Acceptance Criteria:**

**Given** the tsconfig.json has strict mode enabled
**When** I write code with potential type issues (implicit any, null checks, etc.)
**Then** TypeScript reports these as errors in my editor

**Given** I run `npm run typecheck`
**When** there are type errors in the codebase
**Then** the command lists all errors with file locations and descriptions
**And** the command exits with a non-zero status

**Given** the type checking is running
**When** it completes on the full project
**Then** the total execution time is under 60 seconds

**FRs Covered:** FR8, FR9, FR10
**NFRs Covered:** NFR3

#### Story 2.2: Resolve All Existing Type Errors

As a **developer**,
I want **all existing type errors in the codebase resolved**,
So that **the project maintains a clean type-safe baseline**.

**Acceptance Criteria:**

**Given** TypeScript strict mode is enabled
**When** I run `npm run typecheck`
**Then** the command exits with zero errors

**Given** I encounter a type error while fixing
**When** I read the error message
**Then** it provides enough context to understand and fix the issue

**Given** all type errors are resolved
**When** pre-commit hooks run on any commit
**Then** type checking passes without errors

**FRs Covered:** FR11
**NFRs Covered:** NFR4

---

### Epic 3: BMAD Workflow Integration

**User Outcome:** AI assistants stay on-workflow during development tasks by following BMAD methodology, ensuring consistent use of planning, solutioning, and implementation workflows with proper status tracking.

**What users can do after this epic:**

- AI assistants automatically use correct BMAD workflows for each task type
- Planning tasks (PRD, research) route to proper BMAD workflows
- Solutioning tasks (architecture, UX, epics) route to proper BMAD workflows
- Implementation tasks require active sprint-status.yaml
- Code review and retrospectives follow BMAD workflows
- Workflow status tracked properly via bmm-workflow-status.yaml (never manually edited)

**FRs Covered:** FR15, FR16, FR17, FR18, FR19, FR20

**NFRs Addressed:** None

#### Story 3.1: Add BMAD Workflow Mapping to CLAUDE.md

As a **developer or AI assistant**,
I want **CLAUDE.md to contain a "Development Workflow" section that maps task types to specific BMAD workflows**,
So that **I always know which workflow command to use for any development task**.

**Acceptance Criteria:**

**Given** I open CLAUDE.md
**When** I look for development workflow guidance
**Then** I find a "Development Workflow" section with clear task-to-workflow mappings

**Given** I have a planning task (PRD, research, product brief)
**When** I check the workflow mapping in CLAUDE.md
**Then** I see the specific `/bmad:bmm:workflows:` command to use (e.g., `create-prd`, `research`, `create-product-brief`)

**Given** I have a solutioning task (architecture, UX design, epics/stories)
**When** I check the workflow mapping in CLAUDE.md
**Then** I see the specific `/bmad:bmm:workflows:` command to use (e.g., `create-architecture`, `create-ux-design`, `create-epics-stories`)

**FRs Covered:** FR15, FR16, FR17

---

#### Story 3.2: Document Implementation and Review Workflow Requirements

As a **developer or AI assistant**,
I want **CLAUDE.md to document that implementation tasks require an active sprint-status.yaml and specific workflows for code review and retrospectives**,
So that **I follow the correct BMAD process throughout the development lifecycle**.

**Acceptance Criteria:**

**Given** I want to implement a feature or story
**When** I check CLAUDE.md for implementation guidance
**Then** I see that `sprint-status.yaml` must exist and be active before using `dev-story` workflow

**Given** I want to perform a code review
**When** I check CLAUDE.md for review guidance
**Then** I see the specific `/bmad:bmm:workflows:code-review` command to use

**Given** I want to run a retrospective after completing work
**When** I check CLAUDE.md for retrospective guidance
**Then** I see the specific `/bmad:bmm:workflows:retrospective` command to use

**FRs Covered:** FR18, FR19

---

#### Story 3.3: Enforce Workflow-Only Status File Updates

As a **developer or AI assistant**,
I want **clear guidance that bmm-workflow-status.yaml must only be updated through proper BMAD workflows**,
So that **workflow status remains accurate and traceable to workflow executions**.

**Acceptance Criteria:**

**Given** I need to update the BMAD workflow status
**When** I check CLAUDE.md for guidance
**Then** I see explicit instruction that `bmm-workflow-status.yaml` must NOT be manually edited

**Given** the BMAD workflow status needs updating
**When** I consider how to update it
**Then** I use the appropriate BMAD workflow which updates the file automatically via its frontmatter/steps

**Given** I manually edit `bmm-workflow-status.yaml` or `docs/bmm-workflow-status.yaml`
**When** code review or any validation occurs
**Then** this is flagged as a violation of the workflow process

**FRs Covered:** FR20
