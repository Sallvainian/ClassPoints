# Test Design: Epic 3 - BMAD Workflow Integration

**Date:** 2025-12-14
**Author:** Sallvain
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic 3 - BMAD Workflow Integration

**Risk Summary:**

- Total risks identified: 5
- High-priority risks (≥6): 0
- Critical categories: TECH, BUS, OPS

**Coverage Summary:**

- P0 scenarios: 0 (0 hours)
- P1 scenarios: 6 (3 hours)
- P2/P3 scenarios: 3 (0.75 hours)
- **Total effort**: 3.75 hours (~0.5 days)

---

## Risk Assessment

### Context: Documentation-Only Epic

Epic 3 is unique in this project because it involves **documentation updates only** - specifically updating CLAUDE.md to include BMAD workflow guidance. There is no production code being written, no database changes, and no UI modifications.

This significantly reduces the risk profile compared to code-focused epics. The primary risks are:

1. **Guidance accuracy** - incorrect workflow commands documented
2. **Completeness** - missing task-type mappings
3. **Clarity** - confusing or ambiguous instructions
4. **Discoverability** - information hard to find in CLAUDE.md

### Risk Analysis

| Risk ID | Category | Description                                                    | Probability | Impact | Score | Mitigation                                                  |
| ------- | -------- | -------------------------------------------------------------- | ----------- | ------ | ----- | ----------------------------------------------------------- |
| R3-001  | TECH     | Incorrect BMAD workflow command names documented               | 2           | 2      | 4     | Validate commands against actual .bmad directory            |
| R3-002  | BUS      | Incomplete task-type-to-workflow mapping                       | 2           | 2      | 4     | Cross-reference all FR15-FR20 against documentation         |
| R3-003  | OPS      | bmm-workflow-status.yaml gets manually edited despite guidance | 2           | 2      | 4     | Add explicit warning in CLAUDE.md; consider pre-commit hook |
| R3-004  | TECH     | Sprint-status.yaml check guidance is unclear                   | 1           | 2      | 2     | Document clear pre-conditions in workflow section           |
| R3-005  | BUS      | AI assistants skip CLAUDE.md and don't follow workflows        | 1           | 2      | 2     | Structured section with clear headings                      |

### Risk Category Legend

- **TECH**: Technical/Architecture (incorrect commands, missing files)
- **BUS**: Business Impact (AI assistants not following workflows, incomplete coverage)
- **OPS**: Operations (manual status file edits, workflow violations)

### No High-Priority Risks (Score ≥6)

This epic has **no high-priority risks** because:

1. **Documentation-only changes** - No production code affected
2. **No runtime impact** - Changes don't affect application behavior
3. **Easy to verify** - Content can be visually inspected
4. **Easy to rollback** - Git revert is trivial for markdown changes
5. **Low blast radius** - Only affects development workflow guidance

---

## Test Coverage Plan

### Testing Philosophy for Documentation Epics

Traditional automated testing (unit, integration, E2E) is **not applicable** for documentation-only changes like Epic 3. Instead, we use:

1. **Content Verification Tests** - Validate that specific content exists in CLAUDE.md
2. **Cross-Reference Validation** - Verify documented commands match actual files
3. **Manual Review Checklist** - Human verification of clarity and completeness

### P1 (High) - Validation Tests

**Criteria**: Core documentation requirements that directly address FRs

| Requirement                                     | Test Type            | Risk Link | Test Count | Owner | Notes                                                                               |
| ----------------------------------------------- | -------------------- | --------- | ---------- | ----- | ----------------------------------------------------------------------------------- |
| FR15: "Development Workflow" section exists     | Content Verification | R3-002    | 1          | QA    | Grep for section header                                                             |
| FR16: Planning task commands documented         | Cross-Reference      | R3-001    | 1          | QA    | Validate create-prd, research, create-product-brief commands exist                  |
| FR17: Solutioning task commands documented      | Cross-Reference      | R3-001    | 1          | QA    | Validate create-architecture, create-ux-design, create-epics-stories commands exist |
| FR18: Sprint-status.yaml requirement documented | Content Verification | R3-004    | 1          | QA    | Check implementation section mentions sprint-status.yaml                            |
| FR19: Code review/retro workflows documented    | Cross-Reference      | R3-001    | 1          | QA    | Validate code-review, retrospective commands exist                                  |
| FR20: Manual edit prohibition documented        | Content Verification | R3-003    | 1          | QA    | Grep for explicit warning about bmm-workflow-status.yaml                            |

**Total P1**: 6 tests, 3 hours

### P2 (Medium) - Quality Checks

**Criteria**: Secondary documentation quality concerns

| Requirement             | Test Type          | Risk Link | Test Count | Owner | Notes                             |
| ----------------------- | ------------------ | --------- | ---------- | ----- | --------------------------------- |
| Section is discoverable | Manual Review      | R3-005    | 1          | DEV   | Review placement and headers      |
| Instructions are clear  | Manual Review      | R3-002    | 1          | DEV   | Read as if first-time user        |
| All task types covered  | Completeness Check | R3-002    | 1          | DEV   | Matrix of task types vs workflows |

**Total P2**: 3 tests, 0.75 hours

### P3 (Low) - None

Given the documentation-only nature and low risk profile, no P3 tests are planned.

---

## Test Implementation Strategy

### Approach: Shell Script Validation

Since this is a documentation epic, we'll use **shell script validation** rather than traditional test frameworks. This keeps tests simple and directly verifiable.

### Test Script: `scripts/validate-claude-md-workflows.sh`

```bash
#!/bin/bash
# Validate CLAUDE.md contains required BMAD workflow documentation
# Exit codes: 0 = PASS, 1 = FAIL

CLAUDE_MD="CLAUDE.md"
BMAD_DIR=".bmad/bmm/workflows"
ERRORS=0

echo "=== Validating CLAUDE.md BMAD Workflow Documentation ==="

# FR15: Check "Development Workflow" section exists
if grep -q "## Development Workflow" "$CLAUDE_MD" || grep -q "## BMAD Workflow" "$CLAUDE_MD"; then
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
if grep -q "sprint-status.yaml" "$CLAUDE_MD" || grep -q "sprint-status" "$CLAUDE_MD"; then
  echo "✅ FR18: sprint-status.yaml requirement documented"
else
  echo "❌ FR18: sprint-status.yaml requirement NOT documented"
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
if grep -q "bmm-workflow-status" "$CLAUDE_MD" && (grep -q "NOT.*manual" "$CLAUDE_MD" || grep -q "not.*manually" "$CLAUDE_MD" || grep -q "never.*edit" "$CLAUDE_MD"); then
  echo "✅ FR20: Manual edit prohibition documented"
else
  echo "❌ FR20: Manual edit prohibition NOT documented (must mention bmm-workflow-status.yaml and prohibition)"
  ERRORS=$((ERRORS + 1))
fi

# Cross-reference: Verify documented commands actually exist
echo ""
echo "=== Cross-Reference Validation ==="
for workflow_dir in "$BMAD_DIR"/*; do
  workflow_name=$(basename "$workflow_dir")
  if [ -d "$workflow_dir" ]; then
    if grep -q "$workflow_name" "$CLAUDE_MD"; then
      echo "✅ Workflow '$workflow_name' documented and exists"
    else
      echo "⚠️  Workflow '$workflow_name' exists but not documented (may be optional)"
    fi
  fi
done

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

### Execution Order

#### Smoke Tests (<1 min)

- [ ] `grep "Development Workflow\|BMAD" CLAUDE.md` returns results (15s)

#### P1 Tests (<5 min)

- [ ] Run `scripts/validate-claude-md-workflows.sh` (2 min)
- [ ] Visual inspection of section placement (2 min)

#### P2 Tests (<10 min)

- [ ] Manual review: Read workflow section as first-time user (5 min)
- [ ] Completeness matrix: Map all FRs to documented content (5 min)

---

## Resource Estimates

### Test Development Effort

| Priority  | Count | Hours/Test | Total Hours | Notes                              |
| --------- | ----- | ---------- | ----------- | ---------------------------------- |
| P0        | 0     | -          | 0           | No P0 tests (documentation epic)   |
| P1        | 6     | 0.5        | 3           | Shell script + manual verification |
| P2        | 3     | 0.25       | 0.75        | Manual review only                 |
| P3        | 0     | -          | 0           | None planned                       |
| **Total** | **9** | **-**      | **3.75**    | **~0.5 days**                      |

### Prerequisites

**Test Data:**

- None required (documentation validation only)

**Tooling:**

- Bash for validation script
- grep/awk for content checks
- Manual review checklist

**Environment:**

- Local development environment
- Access to CLAUDE.md and .bmad directory

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P1 pass rate**: 100% (all FR checks must pass)
- **P2 pass rate**: ≥90% (manual reviews complete)
- **High-risk mitigations**: N/A (no high-risk items)

### Coverage Targets

- **Functional Requirements**: 100% of FR15-FR20 validated
- **Cross-reference accuracy**: 100% (documented commands exist)
- **Clarity**: Manual review approval

### Non-Negotiable Requirements

- [ ] All P1 content verification tests pass
- [ ] Cross-reference validation passes (commands exist)
- [ ] Manual review confirms clarity and completeness

---

## Mitigation Plans

### R3-001: Incorrect BMAD workflow command names (Score: 4)

**Mitigation Strategy:** Validate documented commands against actual .bmad/bmm/workflows directory
**Owner:** QA
**Timeline:** During story implementation
**Status:** Planned
**Verification:** Cross-reference test in validation script

### R3-002: Incomplete task-type-to-workflow mapping (Score: 4)

**Mitigation Strategy:** Create matrix of task types (planning, solutioning, implementation, review) and verify each has documented workflow
**Owner:** QA
**Timeline:** During story review
**Status:** Planned
**Verification:** Completeness matrix review

### R3-003: Manual bmm-workflow-status.yaml edits (Score: 4)

**Mitigation Strategy:** Add explicit warning in CLAUDE.md; optionally add pre-commit hook to detect manual edits
**Owner:** DEV
**Timeline:** Story 3.3 implementation
**Status:** Planned
**Verification:** grep test for prohibition text

---

## Assumptions and Dependencies

### Assumptions

1. BMAD framework is already installed and .bmad directory exists
2. Workflow commands in documentation reference actual installed workflows
3. CLAUDE.md structure allows adding a new "Development Workflow" section
4. AI assistants will read CLAUDE.md before starting work

### Dependencies

1. Epic 1 and Epic 2 not required before Epic 3 (documentation is independent)
2. BMAD installation must be complete before validation tests can run

### Risks to Plan

- **Risk**: BMAD workflows change names/structure after documentation written
  - **Impact**: Documentation becomes stale
  - **Contingency**: Include validation script in CI to catch drift

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: {name} Date: {date}
- [ ] Tech Lead: {name} Date: {date}
- [ ] QA Lead: {name} Date: {date}

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `docs/prd.md`
- Epic: `docs/epics.md` (Epic 3 section)
- Architecture: `docs/architecture.md`
- System Test Design: `docs/test-design-system.md`

### FR Traceability Matrix

| FR   | Story | Description                                       | Test Type            | Validated By      |
| ---- | ----- | ------------------------------------------------- | -------------------- | ----------------- |
| FR15 | 3.1   | CLAUDE.md contains "Development Workflow" section | Content Verification | grep test         |
| FR16 | 3.1   | Planning tasks routed to BMAD workflows           | Cross-Reference      | grep + file check |
| FR17 | 3.1   | Solutioning tasks routed to BMAD workflows        | Cross-Reference      | grep + file check |
| FR18 | 3.2   | Implementation requires sprint-status.yaml        | Content Verification | grep test         |
| FR19 | 3.2   | Code review/retro use BMAD workflows              | Cross-Reference      | grep + file check |
| FR20 | 3.3   | bmm-workflow-status.yaml via workflows only       | Content Verification | grep test         |

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `.bmad/bmm/testarch/test-design`
**Version**: 4.0 (BMad v6)
