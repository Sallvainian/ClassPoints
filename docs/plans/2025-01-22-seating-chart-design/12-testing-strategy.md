# 12. Testing Strategy

## Unit Tests (Vitest)

```typescript
// tests/unit/randomize.test.ts
describe('randomizeAssignments', () => {
  it('assigns all students to available desks', () => {
    const students = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    const desks = [
      { id: 'd1', row: 0, col: 0, isRemoved: false },
      { id: 'd2', row: 0, col: 1, isRemoved: false },
      { id: 'd3', row: 0, col: 2, isRemoved: true }, // Removed
    ];

    const result = randomizeAssignments(students, desks);

    expect(result).toHaveLength(2);
    expect(result.every((a) => a.studentId !== null)).toBe(true);
  });

  it('leaves extra desks empty when fewer students than desks', () => {
    // ...
  });
});
```

## Component Tests (React Testing Library)

```typescript
// tests/components/Desk.test.tsx
describe('Desk', () => {
  it('displays student name when assigned', () => {
    render(
      <Desk
        desk={{ id: 'd1', row: 0, col: 0, isRemoved: false }}
        student={{ id: 's1', name: 'Alice' }}
        assignment={{ deskId: 'd1', studentId: 's1' }}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows empty state when no student assigned', () => {
    // ...
  });
});
```

## E2E Tests (Playwright)

```typescript
// tests/e2e/export.spec.ts
test('exports chart as PNG image', async ({ page }) => {
  await page.goto('/');

  // Create class and chart
  await page.click('[data-testid="create-class"]');
  await page.fill('[data-testid="class-name"]', 'Test Class');
  await page.click('[data-testid="save-class"]');

  // Create chart
  await page.click('[data-testid="create-chart"]');
  await page.click('[data-testid="template-traditional-rows"]');

  // Export
  const downloadPromise = page.waitForEvent('download');
  await page.click('[data-testid="export-image"]');
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/seating-chart-.*\.png/);
});
```

---
