import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';

// Phase 4 dissolved the server-data facade: AppProvider no longer calls the
// feature-data hooks (useStudents/useTransactions/…) or exposes an aggregate
// `loading`/`error` — those moved to the consumers' direct hooks. The only
// surviving surface is the active-classroom selection (CAP-2). This probe
// asserts that selection state initializes correctly.
function Probe() {
  const { activeClassroomId } = useApp();
  return <div data-testid="active-classroom">{activeClassroomId ?? 'none'}</div>;
}

describe('AppProvider active-classroom selection', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to no active classroom when none is persisted', () => {
    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    expect(screen.getByTestId('active-classroom')).toHaveTextContent('none');
  });

  it('hydrates the active classroom from localStorage', () => {
    window.localStorage.setItem('app:activeClassroomId', 'classroom-1');

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    expect(screen.getByTestId('active-classroom')).toHaveTextContent('classroom-1');
  });
});
