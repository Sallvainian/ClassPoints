---
paths:
  - 'src/test/**/*.test.ts'
  - 'src/test/**/*.test.tsx'
  - 'e2e/**/*.spec.ts'
---

# Testing Patterns

---

## Test Organization

| Type       | Location    | Framework  |
| ---------- | ----------- | ---------- |
| Unit tests | `src/test/` | Vitest     |
| E2E tests  | `e2e/`      | Playwright |

---

## Naming Conventions

- **Unit test files:** `{ComponentName}.test.tsx` or `{hookName}.test.ts`
- **E2E test files:** `{feature}.spec.ts`
- **Test descriptions:** Start with "should" for behavior

---

## Unit Test Pattern

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  it('should render correctly with props', () => {
    render(<Component prop="value" />);
    expect(screen.getByText('value')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const onAction = vi.fn();
    render(<Component onAction={onAction} />);

    await userEvent.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });
});
```

---

## E2E Test Pattern

```ts
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test('should complete user flow', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="action-button"]');
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

---

## Required Patterns

- Mock Supabase client for unit tests (don't hit real API)
- Use `data-testid` attributes for E2E selectors
- Test behavior, not implementation details
- Clean up after tests (no state leakage)

---

## Anti-Patterns

- **NEVER** test implementation details (internal state, private methods)
- **NEVER** skip cleanup in tests with side effects
- **AVOID** flaky tests (use proper waits, not timeouts)
- **AVOID** testing library internals

---

## E2E Environment

E2E tests require environment variables:

- `TEST_EMAIL` - Test account email
- `TEST_PASSWORD` - Test account password

Tests run against real Supabase (not mocked).

---

## Commands

```bash
npm run test          # Unit tests (watch mode)
npm run test:e2e      # E2E tests (headless)
npm run test:e2e:ui   # E2E with Playwright UI
```

---

## Examples

**Good (testing behavior):**

```ts
it('should display student name after loading', async () => {
  render(<StudentCard studentId="123" />);
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```

**Bad (testing implementation):**

```ts
it('should set loading state to false', async () => {
  const { result } = renderHook(() => useStudents());
  // Testing internal state, not behavior
  expect(result.current.loading).toBe(false);
});
```
