# 11. Error Handling

## Error Scenarios & Responses

| Scenario                    | Detection                             | User Response                                                   |
| --------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| localStorage unavailable    | try/catch on access                   | Show warning banner, continue in-memory                         |
| localStorage quota exceeded | DOMException QuotaExceededError       | Toast: "Storage full. Delete unused classes or export backup."  |
| Invalid data on load        | JSON.parse failure or schema mismatch | Reset to defaults, toast: "Data was corrupted. Starting fresh." |
| Image export failure        | html2canvas rejection                 | Toast: "Export failed. Try again."                              |
| Drag-drop failure           | DnD event error                       | Silent recovery, log error                                      |

## Toast Notification System

```typescript
// src/components/ui/Toast.tsx
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// src/hooks/useToast.ts
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (toast: Omit<Toast, 'id'>) => {
    /* ... */
  };
  const dismissToast = (id: string) => {
    /* ... */
  };

  return { toasts, showToast, dismissToast };
}
```

---
