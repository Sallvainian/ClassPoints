import { useEffect, useState, type ComponentType } from 'react';

// React Query Devtools — DEV only. The dynamic import is inside a useEffect body
// gated on `import.meta.env.DEV`; Vite replaces that flag with a `false` literal
// for prod builds, the entire `if` block dead-codes, and Rollup emits no chunk
// for the devtools package. A module-scope `lazy(() => import(...))` would still
// register the import() with Rollup and produce a devtools chunk — this form
// does not. Covered by a bundle-manifest assertion in CI (see ADR-005).
export function DevtoolsGate() {
  const [Tools, setTools] = useState<ComponentType<{ initialIsOpen?: boolean }> | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV) {
      void import('@tanstack/react-query-devtools').then((m) => {
        setTools(() => m.ReactQueryDevtools);
      });
    }
  }, []);
  return Tools ? <Tools initialIsOpen={false} /> : null;
}
