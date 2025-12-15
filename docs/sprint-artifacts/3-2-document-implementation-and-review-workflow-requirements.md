# Story 3.2: Document Implementation and Review Workflow Requirements

Status: Ready for Review

## Story

As a **developer or AI assistant**,
I want **CLAUDE.md to document that implementation tasks require an active sprint-status.yaml and specific workflows for code review and retrospectives**,
So that **I follow the correct BMAD process throughout the development lifecycle**.

## Acceptance Criteria

1. **Given** I want to implement a feature or story
   **When** I check CLAUDE.md for implementation guidance
   **Then** I see that `sprint-status.yaml` must exist and be active before using `dev-story` workflow

2. **Given** I want to perform a code review
   **When** I check CLAUDE.md for review guidance
   **Then** I see the specific `/bmad:bmm:workflows:code-review` command to use

3. **Given** I want to run a retrospective after completing work
   **When** I check CLAUDE.md for retrospective guidance
   **Then** I see the specific `/bmad:bmm:workflows:retrospective` command to use

**FRs Covered:** FR18, FR19

## Tasks / Subtasks

- [x] Task 1: Add "Implementation Phase" subsection to Development Workflow section (AC: #1)
  - [x] 1.1: Add "### Implementation Phase" header after Solutioning Phase section
  - [x] 1.2: Document prerequisite: `sprint-status.yaml` must exist before implementation
  - [x] 1.3: Document `/bmad:bmm:workflows:sprint-planning` for initializing sprint tracking
  - [x] 1.4: Document `/bmad:bmm:workflows:create-story` for creating story context
  - [x] 1.5: Document `/bmad:bmm:workflows:dev-story` for implementing stories
  - [x] 1.6: Add table format consistent with Planning/Solutioning sections from Story 3.1

- [x] Task 2: Add "Review & Completion Phase" subsection (AC: #2, #3)
  - [x] 2.1: Add "### Review & Completion Phase" header after Implementation Phase
  - [x] 2.2: Document `/bmad:bmm:workflows:code-review` for code review
  - [x] 2.3: Document `/bmad:bmm:workflows:retrospective` for epic retrospectives
  - [x] 2.4: Add usage guidance (when to use each workflow)

- [x] Task 3: Verify all documented commands exist (Validation)
  - [x] 3.1: Verify `sprint-planning` workflow exists in `.bmad/bmm/workflows/`
  - [x] 3.2: Verify `create-story` workflow exists in `.bmad/bmm/workflows/`
  - [x] 3.3: Verify `dev-story` workflow exists in `.bmad/bmm/workflows/`
  - [x] 3.4: Verify `code-review` workflow exists in `.bmad/bmm/workflows/`
  - [x] 3.5: Verify `retrospective` workflow exists in `.bmad/bmm/workflows/`

## Dev Notes

### Important Dependency: Story 3.1 Must Be Completed First

**CRITICAL**: This story (3.2) ADDS to the "Development Workflow" section created by Story 3.1.

If Story 3.1 is not yet complete:

1. Complete Story 3.1 first to create the base "Development Workflow" section
2. Then return to Story 3.2 to add Implementation and Review phases

### What This Story Changes

**Files to Modify:**

- `CLAUDE.md` - Add new subsections to existing "Development Workflow" section

**This is a documentation-only story** - no code changes, no tests to write, no database changes.

### Exact Content Location

Add the new subsections **within the "Development Workflow" section of CLAUDE.md**, after the "Solutioning Phase" subsection added by Story 3.1.

Expected location: After Story 3.1's content (which ends around line ~220), add:

- "### Implementation Phase" subsection
- "### Review & Completion Phase" subsection

### BMAD Workflow Command Format

All BMAD workflow commands follow this pattern:

```
/bmad:bmm:workflows:<workflow-name>
```

### Verified Workflow Paths

These workflow directories have been verified to exist:

**Implementation Phase (4-implementation):**

- `/bmad:bmm:workflows:sprint-planning` → `.bmad/bmm/workflows/4-implementation/sprint-planning/`
- `/bmad:bmm:workflows:create-story` → `.bmad/bmm/workflows/4-implementation/create-story/`
- `/bmad:bmm:workflows:dev-story` → `.bmad/bmm/workflows/4-implementation/dev-story/`

**Review & Completion Phase (4-implementation):**

- `/bmad:bmm:workflows:code-review` → `.bmad/bmm/workflows/4-implementation/code-review/`
- `/bmad:bmm:workflows:retrospective` → `.bmad/bmm/workflows/4-implementation/retrospective/`

### Content Template for CLAUDE.md

```markdown
### Implementation Phase

> **Prerequisite:** `sprint-status.yaml` must exist before starting implementation. Run `sprint-planning` first if it doesn't exist.

| Task Type       | Command                               | Description                                        |
| --------------- | ------------------------------------- | -------------------------------------------------- |
| Sprint Planning | `/bmad:bmm:workflows:sprint-planning` | Initialize sprint tracking with sprint-status.yaml |
| Create Story    | `/bmad:bmm:workflows:create-story`    | Create comprehensive story context for development |
| Implement Story | `/bmad:bmm:workflows:dev-story`       | Execute story implementation with TDD              |

### Review & Completion Phase

| Task Type     | Command                             | Description                                     |
| ------------- | ----------------------------------- | ----------------------------------------------- |
| Code Review   | `/bmad:bmm:workflows:code-review`   | Run adversarial code review on completed work   |
| Retrospective | `/bmad:bmm:workflows:retrospective` | Run epic retrospective after completing an epic |
```

### Project Structure Notes

- CLAUDE.md is in project root: `/home/sallvain/dev/work/ClassPoints/CLAUDE.md`
- Current CLAUDE.md ends at line ~204 (Story 3.1 will extend this with Development Workflow section)
- This story adds to Story 3.1's content
- This story is documentation-only - safe to edit without code impact

### Previous Story Intelligence (Story 3.1)

From Story 3.1 (same epic), key learnings to apply:

1. **Table format consistency**: Use the same markdown table format as Story 3.1's Planning/Solutioning phases
2. **Command validation**: Each documented command must be verified to exist in `.bmad/bmm/workflows/`
3. **Placement**: New subsections go AFTER existing sections, maintaining logical flow
4. **Style**: Match the brief descriptions in the table format used by Story 3.1

### Testing Approach

Per the test design document (`docs/test-design-epic-3.md`), validation for this story:

1. **FR18 Validation**: `grep "sprint-status" CLAUDE.md` should return results
2. **FR19 Validation**: `grep "code-review\|retrospective" CLAUDE.md` should return results
3. **Cross-Reference**: Each documented workflow should exist in `.bmad/bmm/workflows/`

### References

- [Source: docs/epics.md#Story 3.2] - Story requirements and acceptance criteria
- [Source: docs/test-design-epic-3.md] - Test design and validation approach
- [Source: docs/prd.md#FR18-FR19] - Functional requirements coverage
- [Source: docs/sprint-artifacts/3-1-add-bmad-workflow-mapping-to-claude-md.md] - Previous story context

## Dev Agent Record

### Context Reference

Story context created by BMAD create-story workflow.

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Documentation-only story

### Completion Notes List

- Story 3.2 is the second story in Epic 3 (BMAD Workflow Integration)
- **DEPENDS ON Story 3.1** - Must have "Development Workflow" section before adding Implementation/Review phases
- This is a documentation-only change to CLAUDE.md
- No code, database, or test changes required
- Story 3.3 will add the status file guidance to complete Epic 3

### File List

Files to be created/modified:

- `CLAUDE.md` (modify - add new subsections to Development Workflow section)
