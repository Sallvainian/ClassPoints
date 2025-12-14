# Tech-Spec: BMAD Workflow Integration

**Created:** 2025-12-14
**Status:** Ready for Development
**Epic:** 3 - BMAD Workflow Integration

## Overview

### Problem Statement

AI assistants working on ClassPoints don't have clear guidance on which BMAD workflow to use for different development tasks. This leads to:

1. **Inconsistent workflow usage** - Tasks may skip required workflows or use wrong ones
2. **Manual status file editing** - `bmm-workflow-status.yaml` gets edited directly instead of through workflows
3. **Missing prerequisites** - Implementation tasks start without active sprint tracking

### Solution

Update `CLAUDE.md` with a comprehensive "Development Workflow" section that:

1. Maps task types to specific BMAD workflow commands
2. Documents prerequisites (e.g., sprint-status.yaml required for implementation)
3. Explicitly prohibits manual editing of workflow status files
4. Provides clear guidance for all development phases

### Scope (In/Out)

**In Scope:**

- Story 3.1: Add BMAD Workflow Mapping to CLAUDE.md (FR15, FR16, FR17)
- Story 3.2: Document Implementation and Review Requirements (FR18, FR19)
- Story 3.3: Enforce Workflow-Only Status File Updates (FR20)
- Create validation script `scripts/validate-claude-md-workflows.sh`

**Out of Scope:**

- No production code changes
- No database changes
- No UI modifications
- No automated enforcement hooks (optional enhancement noted in test design)

## Context for Development

### Codebase Patterns

This is a **documentation-only epic**. The implementation involves:

- Markdown editing in `CLAUDE.md`
- Shell script creation for validation

### Files to Reference

| File                         | Purpose                                  |
| ---------------------------- | ---------------------------------------- |
| `CLAUDE.md`                  | Target file for workflow documentation   |
| `docs/epics.md`              | Epic 3 requirements and stories          |
| `docs/test-design-epic-3.md` | Test design with validation requirements |
| `.bmad/bmm/workflows/`       | Source of truth for available workflows  |

### Technical Decisions

1. **Section Placement**: "Development Workflow" section goes after "Common Operations" and before "Commands"
2. **Command Format**: Use `/bmad:bmm:workflows:` prefix for all workflow commands
3. **Table Format**: Use tables for task-to-workflow mapping for clarity
4. **Validation**: Shell script rather than test framework (matches documentation nature)

## Implementation Plan

### Tasks

#### Task 1: Add Development Workflow Section to CLAUDE.md

**File:** `CLAUDE.md`

**Location:** After "Common Operations" section (line ~117), before "Commands" section

**Content Structure:**

```markdown
## Development Workflow

This project uses BMAD (BMad Methodology for AI-Assisted Development) workflows. AI assistants MUST use the appropriate workflow for each task type.

### Workflow by Task Type

| Task Type                | Phase          | Workflow Command                                     |
| ------------------------ | -------------- | ---------------------------------------------------- |
| Product Brief            | Analysis       | `/bmad:bmm:workflows:create-product-brief`           |
| Research                 | Analysis       | `/bmad:bmm:workflows:research`                       |
| PRD Creation             | Planning       | `/bmad:bmm:workflows:create-prd`                     |
| UX Design                | Planning       | `/bmad:bmm:workflows:create-ux-design`               |
| Architecture             | Solutioning    | `/bmad:bmm:workflows:create-architecture`            |
| Epics & Stories          | Solutioning    | `/bmad:bmm:workflows:create-epics-stories`           |
| Implementation Readiness | Solutioning    | `/bmad:bmm:workflows:check-implementation-readiness` |
| Sprint Planning          | Implementation | `/bmad:bmm:workflows:sprint-planning`                |
| Sprint Status            | Implementation | `/bmad:bmm:workflows:sprint-status`                  |
| Story Creation           | Implementation | `/bmad:bmm:workflows:create-story`                   |
| Story Development        | Implementation | `/bmad:bmm:workflows:dev-story`                      |
| Code Review              | Review         | `/bmad:bmm:workflows:code-review`                    |
| Retrospective            | Review         | `/bmad:bmm:workflows:retrospective`                  |

### Quick Workflows

For rapid development without full ceremony:

| Task              | Command                                |
| ----------------- | -------------------------------------- |
| Tech Spec         | `/bmad:bmm:workflows:create-tech-spec` |
| Quick Development | `/bmad:bmm:workflows:quick-dev`        |

### Implementation Prerequisites

**Before using `dev-story` workflow:**

1. `docs/sprint-artifacts/sprint-status.yaml` MUST exist and be active
2. Use `/bmad:bmm:workflows:sprint-planning` to create/update sprint status
3. Story must be defined in epics document or created via `create-story`

### Status File Rules

**CRITICAL: Never manually edit these files:**

- `docs/bmm-workflow-status.yaml`
- Any BMAD workflow status tracking files

These files are automatically updated by BMAD workflows. Manual edits will cause workflow tracking issues.

**If status needs updating:** Run the appropriate BMAD workflow, which will update status as part of its execution.
```

**Acceptance Criteria:**

- [ ] AC 1: Given I open CLAUDE.md, When I search for "Development Workflow", Then I find a section with task-to-workflow mappings
- [ ] AC 2: Given I have a planning task, When I check CLAUDE.md, Then I find the specific `/bmad:bmm:workflows:` command (create-prd, research, create-product-brief)
- [ ] AC 3: Given I have a solutioning task, When I check CLAUDE.md, Then I find the specific `/bmad:bmm:workflows:` command (create-architecture, create-ux-design, create-epics-stories)
- [ ] AC 4: Given I want to implement a story, When I check CLAUDE.md, Then I see sprint-status.yaml must exist before using dev-story
- [ ] AC 5: Given I want to do code review, When I check CLAUDE.md, Then I find `/bmad:bmm:workflows:code-review`
- [ ] AC 6: Given I want to update bmm-workflow-status.yaml, When I check CLAUDE.md, Then I see explicit instruction NOT to edit manually

---

#### Task 2: Create Validation Script

**File:** `scripts/validate-claude-md-workflows.sh`

**Purpose:** Validate CLAUDE.md contains required BMAD workflow documentation per FR15-FR20

```bash
#!/bin/bash
# Validate CLAUDE.md contains required BMAD workflow documentation
# Exit codes: 0 = PASS, 1 = FAIL

CLAUDE_MD="CLAUDE.md"
BMAD_DIR=".bmad/bmm/workflows"
ERRORS=0

echo "=== Validating CLAUDE.md BMAD Workflow Documentation ==="

# FR15: Check "Development Workflow" section exists
if grep -q "## Development Workflow" "$CLAUDE_MD"; then
  echo "✅ FR15: Development Workflow section found"
else
  echo "❌ FR15: Development Workflow section NOT found"
  ERRORS=$((ERRORS + 1))
fi

# FR16: Check planning workflow commands
for cmd in "create-prd" "research" "create-product-brief"; do
  if grep -q "$cmd" "$CLAUDE_MD"; then
    echo "✅ FR16: Planning command '$cmd' documented"
  else
    echo "❌ FR16: Planning command '$cmd' NOT documented"
    ERRORS=$((ERRORS + 1))
  fi
done

# FR17: Check solutioning workflow commands
for cmd in "create-architecture" "create-ux-design" "create-epics-stories"; do
  if grep -q "$cmd" "$CLAUDE_MD"; then
    echo "✅ FR17: Solutioning command '$cmd' documented"
  else
    echo "❌ FR17: Solutioning command '$cmd' NOT documented"
    ERRORS=$((ERRORS + 1))
  fi
done

# FR18: Check sprint-status.yaml mention
if grep -q "sprint-status" "$CLAUDE_MD"; then
  echo "✅ FR18: sprint-status requirement documented"
else
  echo "❌ FR18: sprint-status requirement NOT documented"
  ERRORS=$((ERRORS + 1))
fi

# FR19: Check review/retro workflow commands
for cmd in "code-review" "retrospective"; do
  if grep -q "$cmd" "$CLAUDE_MD"; then
    echo "✅ FR19: Review command '$cmd' documented"
  else
    echo "❌ FR19: Review command '$cmd' NOT documented"
    ERRORS=$((ERRORS + 1))
  fi
done

# FR20: Check manual edit prohibition
if grep -q "bmm-workflow-status" "$CLAUDE_MD" && grep -qi "never.*manual\|not.*manual\|do not.*edit" "$CLAUDE_MD"; then
  echo "✅ FR20: Manual edit prohibition documented"
else
  echo "❌ FR20: Manual edit prohibition NOT documented"
  ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "=== Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo "✅ All validation checks PASSED"
  exit 0
else
  echo "❌ $ERRORS validation check(s) FAILED"
  exit 1
fi
```

**Acceptance Criteria:**

- [ ] AC 1: Script exists at `scripts/validate-claude-md-workflows.sh`
- [ ] AC 2: Script is executable (`chmod +x`)
- [ ] AC 3: Script exits 0 when all FR15-FR20 validations pass
- [ ] AC 4: Script exits 1 and lists failures when validations fail

---

### Acceptance Criteria Summary

| FR   | Story | Acceptance Criteria                                                                           |
| ---- | ----- | --------------------------------------------------------------------------------------------- |
| FR15 | 3.1   | "Development Workflow" section exists in CLAUDE.md                                            |
| FR16 | 3.1   | Planning commands (create-prd, research, create-product-brief) documented                     |
| FR17 | 3.1   | Solutioning commands (create-architecture, create-ux-design, create-epics-stories) documented |
| FR18 | 3.2   | sprint-status.yaml prerequisite documented for dev-story                                      |
| FR19 | 3.2   | code-review and retrospective commands documented                                             |
| FR20 | 3.3   | bmm-workflow-status.yaml manual edit prohibition documented                                   |

## Additional Context

### Dependencies

- None - this is a documentation-only epic
- No runtime dependencies
- No build dependencies

### Testing Strategy

Per `docs/test-design-epic-3.md`:

1. **Automated Validation**: Run `scripts/validate-claude-md-workflows.sh`
2. **Manual Review**:
   - Verify section placement and discoverability
   - Read as first-time user to assess clarity
   - Cross-reference all FRs against content

### Implementation Order

1. Task 1: Add Development Workflow section to CLAUDE.md
2. Task 2: Create validation script
3. Run validation script to confirm all checks pass
4. Manual review for clarity and completeness

### Notes

- **Risk R3-003 Mitigation**: The explicit "CRITICAL: Never manually edit" language addresses the risk of manual bmm-workflow-status.yaml edits
- **Future Enhancement**: A pre-commit hook could enforce the manual edit prohibition, but is out of scope for this epic
- **Validation Script Location**: Placed in `scripts/` to match project conventions for tooling scripts

---

**Ready for implementation.**
