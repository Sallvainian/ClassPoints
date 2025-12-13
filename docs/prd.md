---
stepsCompleted: [1, 2, 3, 4, 8, 9, 10, 11]
inputDocuments:
  - docs/index.md
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 1
workflowType: 'prd'
lastStep: 11
workflowComplete: true
project_name: 'ClassPoints'
user_name: 'Sallvain'
date: '2025-12-12'
stepsSkipped: [5, 6, 7]
---

# Product Requirements Document - ClassPoints

**Author:** Sallvain
**Date:** 2025-12-12

## Executive Summary

ClassPoints is an existing classroom behavior management web application that was initially "vibe coded" - built rapidly with working functionality but without rigorous adherence to maintainability patterns. This PRD defines the technical debt remediation and code quality initiative to transform the codebase into a maintainable, pattern-consistent foundation for future development.

**The Goal:** Establish a disciplined development environment with automated tooling, consistent patterns, and clear conventions that prevent drift and enable sustainable feature development.

### What Makes This Special

This initiative addresses the common challenge of maturing a prototype into production-quality code. Rather than adding new features, we're investing in the foundation - making the existing codebase easier to understand, modify, and extend. The key outcomes are:

- **Faster Development:** Consistent patterns and tooling reduce cognitive load and decision fatigue
- **Fewer Bugs:** Automated linting, formatting, and type checking catch issues before they ship
- **Easier Onboarding:** Clear conventions mean any developer (or AI assistant) can contribute without learning project-specific quirks
- **Pattern Consistency:** Git hooks and tooling enforce standards automatically, preventing drift

## Project Classification

**Technical Type:** Web Application (React + TypeScript + Vite + Supabase)
**Domain:** General (local tool, no regulatory requirements)
**Complexity:** Low
**Project Context:** Brownfield - improving existing system (technical debt remediation)

This is a technical health initiative for an existing application, focused on developer experience and code maintainability rather than end-user features.

## Success Criteria

### User Success

The "user" for this initiative is anyone working on the codebase - whether that's the developer or an AI assistant. Success means:

- **Immediate Clarity:** Can understand any file's purpose and patterns within seconds
- **Confident Changes:** Can modify code knowing tooling will catch mistakes before commit
- **Pattern Discovery:** Clear documentation guides implementation decisions
- **No Guesswork:** Established conventions eliminate "how should I do this?" questions

### Business Success

Since this is a personal project, business success = developer productivity:

- **Reduced Debugging Time:** Less time spent fixing pattern inconsistencies or tracking down style issues
- **Faster Feature Development:** Clear patterns mean faster implementation of future features
- **Sustainable Velocity:** Codebase quality enables consistent progress over time

### Technical Success

Measurable technical outcomes:

- **Zero TypeScript Errors:** Strict mode enabled and passing
- **Zero ESLint Warnings:** All linting rules enforced and clean
- **Automated Formatting:** Prettier runs on commit via git hooks
- **Enforced Standards:** Pre-commit hooks prevent non-compliant code from being committed
- **Documented Patterns:** CLAUDE.md contains clear, enforceable coding conventions

### Measurable Outcomes

| Metric                 | Target                       |
| ---------------------- | ---------------------------- |
| TypeScript strict mode | Enabled, zero errors         |
| ESLint warnings        | Zero                         |
| Prettier compliance    | 100% of files formatted      |
| Git hooks              | Pre-commit validation active |
| CLAUDE.md completeness | All patterns documented      |

## Product Scope

### MVP - Minimum Viable Product

Developer experience foundation:

1. **Tooling Setup:** Prettier + ESLint configured with appropriate rules
2. **Git Hooks:** Pre-commit hooks enforcing format and lint
3. **TypeScript Strict Mode:** Enable and fix all resulting errors
4. **Pattern Documentation:** Update CLAUDE.md with clear coding conventions
5. **Code Cleanup:** Address obvious pattern inconsistencies

### Growth Features (Post-MVP)

After the foundation is solid:

1. **UX Polish:** Address app behavioral "jankiness" identified during cleanup
2. **Test Coverage:** Add missing unit and integration tests
3. **Performance Audit:** Identify and fix performance bottlenecks

### Vision (Future)

A codebase that serves as a reference for how to build a React + Supabase application:

- Comprehensive test coverage
- Performance optimized
- Fully documented architecture
- Ready for collaborative development

## User Journeys

For this technical debt initiative, the "users" are developers and AI assistants working on the codebase. Their journeys focus on the development workflow.

### Journey 1: Developer Making a Feature Change

A developer (or AI assistant) needs to add a small feature to ClassPoints. They open the codebase and immediately check CLAUDE.md to understand the patterns and conventions. The file clearly states: components go here, hooks follow this pattern, state management works this way.

They create a new component following the documented pattern. As they work, their editor shows real-time TypeScript errors and ESLint warnings - catching a missing type and an inconsistent import pattern before they even save. When they finish and attempt to commit, the pre-commit hook runs Prettier to auto-format the code and ESLint to validate patterns. The commit succeeds because everything passes.

The result: A clean change that matches existing patterns, validated automatically before it ever hits the repository.

### Journey 2: AI Assistant Understanding the Codebase

An AI coding assistant is asked to fix a bug in ClassPoints. It reads CLAUDE.md first and immediately understands: this is a React + Supabase app, state lives in contexts accessed via useApp(), components follow this naming convention, and here are the key files to look at.

The assistant navigates directly to the relevant files, understands the patterns, and makes a fix that matches existing code style. When it generates the code, TypeScript catches any type mismatches, and the pre-commit hook ensures formatting is consistent.

The result: AI-generated code that fits seamlessly with human-written code, with no pattern drift.

### Journey 3: Developer Debugging an Issue

A developer encounters unexpected behavior. Instead of guessing, they check the documented patterns in CLAUDE.md to understand how data flows through the app. The consistent patterns make it easy to trace the issue - hooks access contexts, contexts manage state, components consume via useApp().

They identify the bug, fix it, and the tooling validates the fix matches project conventions before commit.

The result: Faster debugging because the codebase is predictable and well-documented.

### Journey Requirements Summary

These journeys reveal the core capabilities needed:

| Journey                | Required Capability                                        |
| ---------------------- | ---------------------------------------------------------- |
| Making changes         | Pre-commit hooks, ESLint, Prettier, TypeScript strict mode |
| Understanding codebase | Comprehensive CLAUDE.md documentation                      |
| Debugging issues       | Consistent patterns, clear data flow documentation         |
| AI assistance          | Machine-readable conventions, predictable structure        |

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP - Establish the minimum tooling and patterns that make the codebase maintainable.

**Resource Requirements:** Solo developer with AI assistance. No team coordination overhead.

**Timeline Philosophy:** Complete when all checkboxes pass - zero TypeScript errors, zero ESLint warnings, Prettier on commit, patterns documented.

### MVP Feature Set (Phase 1)

**Core Developer Journeys Supported:**

- Making confident changes with automated validation
- Understanding codebase through clear documentation
- Debugging with consistent, predictable patterns

**Must-Have Capabilities:**

| Capability        | Success Criterion                |
| ----------------- | -------------------------------- |
| Prettier          | Configured and running on commit |
| ESLint            | Zero warnings, rules enforced    |
| TypeScript Strict | Enabled, all errors resolved     |
| Git Hooks         | Pre-commit validation active     |
| CLAUDE.md         | All patterns clearly documented  |

### Post-MVP Features

**Phase 2 (Growth):**

- Address UX "jankiness" identified during cleanup
- Add missing unit and integration tests
- Conduct performance audit and fix bottlenecks

**Phase 3 (Expansion):**

- Comprehensive test coverage
- Performance optimization
- Full architecture documentation
- Ready for collaborative development

### Risk Mitigation Strategy

**Technical Risks:**

- Risk: TypeScript strict mode may reveal many errors
- Mitigation: Fix incrementally, prioritize by severity

**Resource Risks:**

- Risk: Scope creep into feature work
- Mitigation: Stay focused on tooling and patterns only - no new features in MVP

**Quality Risks:**

- Risk: Pattern documentation becomes stale
- Mitigation: Make CLAUDE.md the source of truth, update as patterns evolve

## Functional Requirements

### Code Formatting

- FR1: Developers can have all code automatically formatted to a consistent style on save
- FR2: Developers can run a command to format all files in the project
- FR3: Developers can see formatting applied automatically before any commit

### Code Linting

- FR4: Developers can see linting errors and warnings in real-time in their editor
- FR5: Developers can run a command to check all files for linting issues
- FR6: The system prevents commits that contain linting errors
- FR7: Developers can see which ESLint rules are configured and why

### Type Safety

- FR8: TypeScript catches type errors before code is committed
- FR9: Developers can run a command to check all files for type errors
- FR10: The system uses strict TypeScript mode to catch more potential issues
- FR11: All existing type errors are resolved before MVP completion

### Git Workflow Automation

- FR12: Pre-commit hooks automatically run formatting, linting, and type checks
- FR13: Commits that fail validation are rejected with clear error messages
- FR14: Developers can bypass hooks in emergency situations with explicit flag

### Pattern Documentation (Claude Rules)

- FR15: CLAUDE.md documents universal project context (tech stack, architecture, key files)
- FR16: Modular rules files exist in `.claude/rules/` for path-specific patterns
- FR17: Component rules load only when working on component files
- FR18: Hook rules load only when working on hook files
- FR19: Context/state management rules load only when working on context files
- FR20: Each rules file documents naming conventions, patterns, and examples for its domain
- FR21: AI assistants receive relevant rules automatically based on the files they're editing

### Developer Experience

- FR22: Developers can set up the project with a single npm install command
- FR23: All tooling runs automatically without manual intervention during normal workflow
- FR24: Error messages from tooling are clear and actionable

## Non-Functional Requirements

### Tooling Performance

- NFR1: Pre-commit hooks complete within 10 seconds for typical commits
- NFR2: Full project lint check completes within 30 seconds
- NFR3: TypeScript type checking completes within 60 seconds for full project

### Developer Experience Quality

- NFR4: All error messages include actionable guidance on how to fix the issue
- NFR5: Tooling configuration is documented and easy to understand
- NFR6: New developers can set up the project in under 5 minutes

### Documentation Accuracy

- NFR7: CLAUDE.md and rules files accurately reflect current project patterns
- NFR8: Documentation updates are part of the PR process when patterns change
- NFR9: No outdated or contradictory pattern guidance exists in documentation

### Reliability

- NFR10: Tooling works consistently across all developer machines
- NFR11: Pre-commit hooks don't fail due to environment differences
- NFR12: CI/CD pipeline validates the same rules as local development
