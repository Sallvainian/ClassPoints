# 6. Template System

## Predefined Templates

```typescript
// src/templates/index.ts

export const TEMPLATES: Template[] = [
  {
    id: 'traditional-rows',
    name: 'Traditional Rows',
    description: 'Classic classroom layout with rows facing forward',
    rows: 6,
    cols: 5,
    previewImage: '/templates/traditional-rows.svg',
    desks: generateGrid(6, 5), // All positions filled
  },
  {
    id: 'groups-of-4',
    name: 'Groups of 4',
    description: 'Clustered desks for group work',
    rows: 6,
    cols: 6,
    previewImage: '/templates/groups-of-4.svg',
    desks: [
      // Cluster 1 (top-left)
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      // Cluster 2 (top-right)
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 1, col: 4 },
      { row: 1, col: 5 },
      // ... more clusters
    ],
  },
  {
    id: 'u-shape',
    name: 'U-Shape',
    description: 'Desks arranged in U for discussions',
    rows: 5,
    cols: 7,
    previewImage: '/templates/u-shape.svg',
    desks: generateUShape(5, 7),
  },
  {
    id: 'pairs',
    name: 'Partner Pairs',
    description: 'Two-desk columns for pair work',
    rows: 6,
    cols: 6,
    previewImage: '/templates/pairs.svg',
    desks: generatePairs(6, 6),
  },
  {
    id: 'seminar',
    name: 'Seminar Circle',
    description: 'Large circle for seminar discussions',
    rows: 7,
    cols: 7,
    previewImage: '/templates/seminar.svg',
    desks: generateCircle(7),
  },
];
```

## Template Selection UI

```typescript
// src/components/charts/TemplateSelector.tsx
interface TemplateSelectorProps {
  currentTemplateId: string | null;
  onSelect: (templateId: string) => void;
}

// Renders grid of template preview cards
// Shows visual thumbnail + name + description
// Highlights currently selected template
```

---
