# 8. Export Functionality

## Print Export

```typescript
// src/hooks/useExport.ts

export function useExport(chartRef: RefObject<HTMLElement>) {
  const printChart = useCallback(() => {
    window.print();
  }, []);

  // ... image export below
}
```

```css
/* src/styles/print.css */
@media print {
  /* Hide everything except chart */
  body * {
    visibility: hidden;
  }

  .chart-printable,
  .chart-printable * {
    visibility: visible;
  }

  .chart-printable {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }

  /* Hide UI elements */
  .no-print {
    display: none !important;
  }

  /* Clean styling for print */
  .desk {
    border: 1px solid #333;
    background: white;
  }
}
```

## Image Export

```typescript
// src/hooks/useExport.ts
import html2canvas from 'html2canvas';

export function useExport(chartRef: RefObject<HTMLElement>) {
  const exportAsImage = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
      });

      const link = document.createElement('a');
      link.download = `seating-chart-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      // Show error toast to user
    }
  }, [chartRef]);

  return { exportAsImage, printChart };
}
```

## Export UI

```typescript
// src/components/charts/ExportDropdown.tsx
interface ExportDropdownProps {
  onPrint: () => void;
  onExportImage: () => void;
}

// Dropdown menu with:
// - "Print Chart" option (triggers browser print dialog)
// - "Download as Image" option (downloads PNG)
```

---
