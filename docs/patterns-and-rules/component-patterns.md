# Component Patterns

## Component Structure Pattern

```tsx
interface ComponentProps {
  required: string;
  optional?: boolean;
}

export function Component({ required, optional = false }: ComponentProps) {
  // 1. Hooks at top (context, state, refs, effects)
  const { data } = useApp();
  const [localState, setLocalState] = useState(false);

  // 2. Event handlers
  const handleClick = () => {};

  // 3. Early returns for loading/error states
  if (loading) return <Loading />;
  if (error) return <Error error={error} />;

  // 4. Main render
  return <div>...</div>;
}
```

**Rules:**

- All hooks MUST be called before any early returns
- Props interface defined above component
- Export named functions (not default except App.tsx)

## Modal Pattern

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ...specific props
}

export function FeatureModal({ isOpen, onClose, ... }: ModalProps) {
  // Use Modal wrapper component
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Title">
      {/* Modal content */}
    </Modal>
  );
}
```

**Rules:**

- All modals use the `Modal` wrapper component from `components/ui/`
- `isOpen` and `onClose` are required props
- Modal handles backdrop click and escape key

## Index Barrel Export Pattern

Each component folder has an `index.ts` barrel file:

```tsx
// src/components/students/index.ts
export { StudentGrid } from './StudentGrid';
export { StudentPointCard } from './StudentPointCard';
```

**Rules:**

- Every component folder MUST have an `index.ts`
- Export all public components from the index
- Import from folder, not individual files: `import { StudentGrid } from './components/students'`

---
