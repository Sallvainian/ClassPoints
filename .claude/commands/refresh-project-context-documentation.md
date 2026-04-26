---
name: refresh-project-context-documentation
description: Workflow command scaffold for refresh-project-context-documentation in ClassPoints.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /refresh-project-context-documentation

Use this workflow when working on **refresh-project-context-documentation** in `ClassPoints`.

## Goal

Refreshes and regenerates project context and architecture documentation based on the latest codebase scan, including archiving previous snapshots.

## Common Files

- `docs/architecture.md`
- `docs/component-inventory.md`
- `docs/data-models.md`
- `docs/development-guide.md`
- `docs/index.md`
- `docs/project-overview.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Run project scan tooling to generate updated documentation files.
- Overwrite or update docs such as architecture.md, component-inventory.md, data-models.md, etc.
- Archive the previous project scan report under docs/.archive/.
- Commit all updated and archived documentation files.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.