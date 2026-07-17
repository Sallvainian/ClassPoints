/**
 * useDeleteAccount — the delete-account Edge Function invocation.
 *
 * Contract: POST invoke with no body (the function derives the user from the
 * JWT — nothing to pass), throw the FunctionsError on failure so the modal
 * can surface it and skip sign-out. supabase is full-replacement mocked
 * (credless CI), so only the invoke surface exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

const mockInvoke = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import { useDeleteAccount } from '../useDeleteAccount';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDeleteAccount', () => {
  it('POSTs the delete-account function and resolves on success', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await result.current.mutateAsync();

    expect(mockInvoke).toHaveBeenCalledExactlyOnceWith('delete-account', { method: 'POST' });
  });

  it('throws the FunctionsError so the caller can surface it', async () => {
    const fnError = new Error('Edge Function returned a non-2xx status code');
    mockInvoke.mockResolvedValueOnce({ data: null, error: fnError });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow(
      'Edge Function returned a non-2xx status code'
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
