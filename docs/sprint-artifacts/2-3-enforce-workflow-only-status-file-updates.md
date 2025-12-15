# Story 2.3: Enforce Workflow-Only Status File Updates

Status: Done

## Story

As a **developer or AI assistant**,
I want **clear guidance that bmm-workflow-status.yaml must only be updated through proper BMAD workflows**,
So that **workflow status remains accurate and traceable to workflow executions**.

## Acceptance Criteria

1. **Given** I need to update the BMAD workflow status
   **When** I check CLAUDE.md for guidance
   **Then** I see explicit instruction that `bmm-workflow-status.yaml` must NOT be manually edited

2. **Given** the BMAD workflow status needs updating
   **When** I consider how to update it
   **Then** I use the appropriate BMAD workflow which updates the file automatically via its frontmatter/steps

3. **Given** I manually edit `bmm-workflow-status.yaml` or `docs/bmm-workflow-status.yaml`
   **When** code review or any validation occurs
   **Then** this is flagged as a violation of the workflow process

**FRs Covered:** FR20

## Tasks / Subtasks

- [x] Task 1: Add status file protection guidance to CLAUDE.md (AC: #1, #2)
  - [x] 1.1: Add new subsection "### Status File Rules" after "Review & Completion Phase"
  - [x] 1.2: Add explicit warning that `sprint-status.yaml` must only be updated via BMAD workflows
  - [x] 1.3: Add note that `sprint-planning`, `create-story`, `dev-story`, and `code-review` workflows update status automatically
  - [x] 1.4: Add explicit prohibition language: "NEVER manually edit status files"

- [x] Task 2: Document which workflows modify which status entries (AC: #2)
  - [x] 2.1: Create table mapping status transitions to responsible workflows
  - [x] 2.2: Document epic status transitions (backlog → in-progress → done)
  - [x] 2.3: Document story status transitions (backlog → ready-for-dev → in-progress → review → done)

- [x] Task 3: Add violation detection guidance for code review (AC: #3)
  - [x] 3.1: Add note in Status File Rules section about code review validation
  - [x] 3.2: Document that git diffs showing direct status file edits should be flagged

- [x] Task 4: Run validation tests (Test Design compliance)
  - [x] 4.1: Run `grep "NOT.*manual\|not.*manually\|never.*edit" CLAUDE.md` to verify prohibition text exists
  - [x] 4.2: Verify sprint-status reference exists in new section

## Dev Notes

### Important Dependency: Stories 3.1 and 3.2 Must Be Completed First

**CRITICAL**: This story (3.3) ADDS to the "Development Workflow" section that was created by Story 2.1 and extended by Story 2.2.

Both Story 2.1 and Story 2.2 are **done** (verified in sprint-status.yaml).

### What This Story Changes

**Files to Modify:**

- `CLAUDE.md` - Add "Status File Rules" subsection to existing "Development Workflow" section

**This is a documentation-only story** - no code changes, no tests to write, no database changes.

### Exact Content Location

Add the new subsection **within the "Development Workflow" section of CLAUDE.md**, after the "Review & Completion Phase" subsection at line 275.

Expected location: After line 275 (end of Review & Completion Phase), add:

- "### Status File Rules" subsection

### The Status File in Question

**Primary status file**: `docs/sprint-artifacts/sprint-status.yaml`

This file tracks:

- Epic status: `backlog`, `in-progress`, `done`
- Story status: `backlog`, `drafted`, `ready-for-dev`, `in-progress`, `review`, `done`
- Retrospective status: `optional`, `completed`

### Status Transitions by Workflow

| Workflow          | Status Changes                                                 |
| ----------------- | -------------------------------------------------------------- |
| `sprint-planning` | Creates initial sprint-status.yaml, sets all to `backlog`      |
| `create-story`    | Marks story as `ready-for-dev`, may mark epic as `in-progress` |
| `dev-story`       | Marks story as `in-progress` when starting work                |
| `code-review`     | Marks story as `review` or `done` after successful review      |
| `retrospective`   | Marks epic retrospective as `completed`                        |

### Content Template for CLAUDE.md

```markdown
### Status File Rules

> ⚠️ **CRITICAL**: Status files must NEVER be manually edited. All status updates happen automatically through BMAD workflows.

**Protected Files:**

- `docs/sprint-artifacts/sprint-status.yaml` - Primary sprint tracking file

**Why This Matters:**

- Manual edits break workflow traceability
- Status should reflect actual workflow progress
- Code review will flag direct status file modifications as violations

**Status Update Responsibility:**

| Workflow          | Updates Status To                                                                    |
| ----------------- | ------------------------------------------------------------------------------------ |
| `sprint-planning` | Creates file, initializes all entries to `backlog`                                   |
| `create-story`    | Story: `backlog` → `ready-for-dev`, Epic: `backlog` → `in-progress` (if first story) |
| `dev-story`       | Story: `ready-for-dev` → `in-progress`                                               |
| `code-review`     | Story: `in-progress` → `review` → `done`                                             |
| `retrospective`   | Epic retrospective: `optional` → `completed`                                         |

**Violation Detection:**

During code review, any git diff showing direct edits to `sprint-status.yaml` without corresponding workflow execution is a process violation.
```

### Previous Story Intelligence

From Story 2.1 and 3.2 (same epic), key learnings to apply:

1. **Table format consistency**: Use the same markdown table format as previous stories
2. **Blockquote for warnings**: Use `> ⚠️` format for important warnings (consistent with Story 2.2's prerequisite note)
3. **Placement**: New subsections go AFTER existing sections, maintaining logical flow
4. **Documentation-only**: Safe to edit CLAUDE.md without code impact

### Git Intelligence

Recent commits show Story 2.1 and 3.2 already implemented:

- `e8a894b` - docs: Document BMAD development workflow in CLAUDE.md (Story 2.1 + 3.2)

### Testing Approach

Per the test design document (`docs/test-design-epic-2.md`), validation for this story:

1. **FR20 Validation**: Check for prohibition text using pattern match
   - `grep -i "never.*edit\|NOT.*manual\|not.*manually" CLAUDE.md` should return results
2. **Content Verification**: `grep "sprint-status" CLAUDE.md` should return results in new section
3. **Status Update Table**: Verify workflow-to-status mapping table exists

### Project Structure Notes

- CLAUDE.md is in project root: `/home/sallvain/dev/work/ClassPoints/CLAUDE.md`
- Current CLAUDE.md ends at line 276 after Story 2.2's additions
- This story is documentation-only - safe to edit without code impact
- Alignment with unified project structure: ✅ (docs only, no code changes)
- Detected conflicts or variances: None

### References

- [Source: docs/epics.md#Story 2.3] - Story requirements and acceptance criteria
- [Source: docs/test-design-epic-2.md#FR20] - Test design and validation approach (R3-003 mitigation)
- [Source: docs/prd.md#FR20] - Functional requirements: bmm-workflow-status.yaml via workflows only
- [Source: docs/sprint-artifacts/2-1-add-bmad-workflow-mapping-to-claude-md.md] - Story 2.1 context
- [Source: docs/sprint-artifacts/2-2-document-implementation-and-review-workflow-requirements.md] - Story 2.2 context
- [Source: docs/sprint-artifacts/sprint-status.yaml] - Status definitions and current state

## Dev Agent Record

### Context Reference

Story context created by BMAD create-story workflow (2025-12-14).

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Documentation-only story

### Implementation Plan

Added "Status File Rules" subsection to CLAUDE.md after "Review & Completion Phase" with:

- CRITICAL warning about never manually editing status files
- Protected files list (sprint-status.yaml)
- "Why This Matters" rationale section
- Status Update Responsibility table mapping workflows to status transitions
- Violation Detection guidance for code review

### Completion Notes List

- Story 2.3 is the third and **final story** in Epic 2 (BMAD Workflow Integration)
- **DEPENDS ON Stories 3.1 and 3.2** - Must have full "Development Workflow" section before adding Status File Rules
- This is a documentation-only change to CLAUDE.md
- No code, database, or test changes required
- After this story, Epic 2 is complete and ready for retrospective
- ✅ All ACs satisfied:
  - AC1: Explicit prohibition text added ("must NEVER be manually edited")
  - AC2: Workflow-to-status mapping table with all 5 workflows documented
  - AC3: Violation detection guidance added for code review
- ✅ Validation tests passed:
  - grep for prohibition text returned match
  - sprint-status references found in new section

### File List

Files modified:

- `CLAUDE.md` - Added "Status File Rules" subsection (lines 277-303)
- `docs/sprint-artifacts/sprint-status.yaml` - Updated story status (ready-for-dev → in-progress → review)

### Change Log

| Date       | Change                                                      | Author          |
| ---------- | ----------------------------------------------------------- | --------------- |
| 2025-12-14 | Story context created via create-story                      | Claude Opus 4.5 |
| 2025-12-14 | Implementation complete - all tasks done, validation passed | Claude Opus 4.5 |
