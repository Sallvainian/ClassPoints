# UX Consistency Patterns

## Button Patterns

**Button Hierarchy:**
| Type | Usage | Style |
|------|-------|-------|
| Primary | Main action (Create, Save) | Solid blue, white text |
| Secondary | Alternative action (Cancel) | Outlined, blue text |
| Danger | Destructive action (Delete) | Solid red, white text |
| Ghost | Tertiary action (Learn More) | Text only, hover underline |

**Button States:**
| State | Visual | Cursor |
|-------|--------|--------|
| Default | Full opacity | Pointer |
| Hover | Slightly darker/lighter | Pointer |
| Active | Scale 0.98, darker | Pointer |
| Disabled | 50% opacity | Not-allowed |
| Loading | Spinner, disabled state | Wait |

## Feedback Patterns

**Toast Notifications:**
| Type | Color | Icon | Duration |
|------|-------|------|----------|
| Success | Green | ✓ | 3 seconds |
| Error | Red | ✕ | 5 seconds (or dismiss) |
| Warning | Orange | ⚠ | 5 seconds |
| Info | Blue | ℹ | 3 seconds |

**Placement:** Bottom-center, stacked if multiple.

**In-Line Feedback:**

- Form errors: Red text below field, red border
- Success states: Green checkmark, green border
- Loading states: Skeleton shimmer or spinner

## Empty States

| Context         | Message                                      | Action                    |
| --------------- | -------------------------------------------- | ------------------------- |
| No classrooms   | "Create your first classroom to get started" | "Create Classroom" button |
| No students     | "Add students to start tracking behavior"    | "Add Students" button     |
| No points today | "No points awarded yet today"                | None (informational)      |
| No history      | "Point history will appear here"             | None (informational)      |

## Loading States

| Context            | Pattern                        |
| ------------------ | ------------------------------ |
| Initial load       | Full-screen skeleton           |
| Data refresh       | Subtle spinner in header       |
| Action in progress | Button spinner + disabled      |
| Long operation     | Progress bar (if determinable) |

## Modal Patterns

**Modal Types:**
| Type | Usage | Close Method |
|------|-------|--------------|
| Behavior selection | Point awarding | Auto-close on select, X button, backdrop click |
| Confirmation | Delete actions | Yes/No buttons, X button |
| Settings | Configuration | Save/Cancel buttons, X button |
| Alert | Error messages | OK button, X button |
