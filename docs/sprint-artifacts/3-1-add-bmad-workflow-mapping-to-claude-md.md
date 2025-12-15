# Story 3.1: Add BMAD Workflow Mapping to CLAUDE.md

Status: Ready for Review

## Story

As a **developer or AI assistant**,
I want **CLAUDE.md to contain a "Development Workflow" section that maps task types to specific BMAD workflows**,
So that **I always know which workflow command to use for any development task**.

## Acceptance Criteria

1. **Given** I open CLAUDE.md
   **When** I look for development workflow guidance
   **Then** I find a "Development Workflow" section with clear task-to-workflow mappings

2. **Given** I have a planning task (PRD, research, product brief)
   **When** I check the workflow mapping in CLAUDE.md
   **Then** I see the specific `/bmad:bmm:workflows:` command to use (e.g., `create-prd`, `research`, `create-product-brief`)

3. **Given** I have a solutioning task (architecture, UX design, epics/stories)
   **When** I check the workflow mapping in CLAUDE.md
   **Then** I see the specific `/bmad:bmm:workflows:` command to use (e.g., `create-architecture`, `create-ux-design`, `create-epics-stories`)

**FRs Covered:** FR15, FR16, FR17

## Tasks / Subtasks

- [x] Task 1: Add "Development Workflow" section to CLAUDE.md (AC: #1)
  - [x] 1.1: Create section header `## Development Workflow` after existing documentation sections
  - [x] 1.2: Add brief introduction explaining BMAD methodology
  - [x] 1.3: Structure with clear subsections for each workflow phase

- [x] Task 2: Document Planning Phase workflows (AC: #2)
  - [x] 2.1: Add "### Planning Phase" subsection
  - [x] 2.2: Document `/bmad:bmm:workflows:create-product-brief` for product briefs
  - [x] 2.3: Document `/bmad:bmm:workflows:research` for research tasks
  - [x] 2.4: Document `/bmad:bmm:workflows:create-prd` for PRD creation

- [x] Task 3: Document Solutioning Phase workflows (AC: #3)
  - [x] 3.1: Add "### Solutioning Phase" subsection
  - [x] 3.2: Document `/bmad:bmm:workflows:create-architecture` for architecture design
  - [x] 3.3: Document `/bmad:bmm:workflows:create-ux-design` for UX design
  - [x] 3.4: Document `/bmad:bmm:workflows:create-epics-stories` for epic/story creation

- [x] Task 4: Verify all documented commands exist (Validation)
  - [x] 4.1: Run validation to confirm each workflow path exists in `.bmad/bmm/workflows/`

## Dev Notes

### What This Story Changes

**Files to Modify:**

- `CLAUDE.md` - Add new "Development Workflow" section

**This is a documentation-only story** - no code changes, no tests to write, no database changes.

### Exact Content Location

Add the new section **at the end of CLAUDE.md**, after the "Documentation" section (line ~204).

### BMAD Workflow Command Format

All BMAD workflow commands follow this pattern:

```
/bmad:bmm:workflows:<workflow-name>
```

### Verified Workflow Paths

These workflow directories have been verified to exist:

**Planning Phase (1-analysis, 2-plan-workflows):**

- `/bmad:bmm:workflows:create-product-brief` → `.bmad/bmm/workflows/1-analysis/product-brief/`
- `/bmad:bmm:workflows:research` → `.bmad/bmm/workflows/1-analysis/research/`
- `/bmad:bmm:workflows:create-prd` → `.bmad/bmm/workflows/2-plan-workflows/prd/`

**Solutioning Phase (3-solutioning):**

- `/bmad:bmm:workflows:create-architecture` → `.bmad/bmm/workflows/3-solutioning/architecture/`
- `/bmad:bmm:workflows:create-ux-design` → `.bmad/bmm/workflows/2-plan-workflows/create-ux-design/`
- `/bmad:bmm:workflows:create-epics-stories` → `.bmad/bmm/workflows/3-solutioning/create-epics-and-stories/`

### Content Template for CLAUDE.md

```markdown
## Development Workflow

This project uses the BMAD (Business Method for AI Development) framework for structured development workflows. Use the appropriate slash command for each task type.

### Planning Phase

| Task Type     | Command                                    | Description                                   |
| ------------- | ------------------------------------------ | --------------------------------------------- |
| Product Brief | `/bmad:bmm:workflows:create-product-brief` | Create initial product concept documentation  |
| Research      | `/bmad:bmm:workflows:research`             | Conduct market, technical, or domain research |
| PRD           | `/bmad:bmm:workflows:create-prd`           | Create Product Requirements Document          |

### Solutioning Phase

| Task Type       | Command                                    | Description                                    |
| --------------- | ------------------------------------------ | ---------------------------------------------- |
| Architecture    | `/bmad:bmm:workflows:create-architecture`  | Design system architecture                     |
| UX Design       | `/bmad:bmm:workflows:create-ux-design`     | Create UX design specifications                |
| Epics & Stories | `/bmad:bmm:workflows:create-epics-stories` | Break down requirements into epics and stories |
```

### Project Structure Notes

- CLAUDE.md is in project root: `/home/sallvain/dev/work/ClassPoints/CLAUDE.md`
- Current CLAUDE.md ends at line ~204 with "Documentation" section
- No existing "Development Workflow" section exists (verified)
- This story is documentation-only - safe to edit without code impact

### Testing Approach

Per the test design document (`docs/test-design-epic-3.md`), validation for this story:

1. **Content Verification**: `grep "Development Workflow\|BMAD" CLAUDE.md` should return results
2. **Command Verification**: Each documented command name should be searchable in CLAUDE.md
3. **Cross-Reference**: Each documented workflow should exist in `.bmad/bmm/workflows/`

### References

- [Source: docs/epics.md#Story 3.1] - Story requirements and acceptance criteria
- [Source: docs/test-design-epic-3.md] - Test design and validation approach
- [Source: docs/prd.md#FR15-FR17] - Functional requirements coverage

## Dev Agent Record

### Context Reference

Story context created by BMAD create-story workflow.

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Documentation-only story

### Completion Notes List

- Story 3.1 is the first story in Epic 3 (BMAD Workflow Integration)
- This is a documentation-only change to CLAUDE.md
- No code, database, or test changes required
- Subsequent stories (3.2, 3.3) will add Implementation Phase and status file guidance

**Implementation Complete (2025-12-14):**

- ✅ Added "Development Workflow" section to CLAUDE.md at line 205
- ✅ Added BMAD methodology introduction
- ✅ Documented Planning Phase with 3 workflows: create-product-brief, research, create-prd
- ✅ Documented Solutioning Phase with 3 workflows: create-architecture, create-ux-design, create-epics-stories
- ✅ Validated all 6 workflow directories exist in `.bmad/bmm/workflows/`
- ✅ All acceptance criteria satisfied

### File List

Files created/modified:

- `CLAUDE.md` (modified - added "Development Workflow" section with BMAD workflow mappings)

### Change Log

| Date       | Change                                                                                                | Author          |
| ---------- | ----------------------------------------------------------------------------------------------------- | --------------- |
| 2025-12-14 | Added Development Workflow section to CLAUDE.md with Planning and Solutioning phase workflow mappings | Claude Opus 4.5 |
