# 10. Project Structure

```
seating-chart/
├── public/
│   └── templates/           # Template preview SVGs
│       ├── traditional-rows.svg
│       ├── groups-of-4.svg
│       └── ...
├── src/
│   ├── components/
│   │   ├── ui/              # Generic UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── classes/
│   │   │   ├── ClassList.tsx
│   │   │   ├── ClassCard.tsx
│   │   │   └── ClassForm.tsx
│   │   ├── students/
│   │   │   ├── StudentList.tsx
│   │   │   ├── StudentItem.tsx
│   │   │   └── StudentForm.tsx
│   │   └── charts/
│   │       ├── ChartCanvas.tsx
│   │       ├── DeskGrid.tsx
│   │       ├── Desk.tsx
│   │       ├── StudentCard.tsx
│   │       ├── TemplateSelector.tsx
│   │       ├── ExportDropdown.tsx
│   │       └── UnassignedStudents.tsx
│   ├── contexts/
│   │   └── AppContext.tsx
│   ├── hooks/
│   │   ├── usePersistedState.ts
│   │   ├── useChart.ts
│   │   └── useExport.ts
│   ├── templates/
│   │   ├── index.ts
│   │   └── generators.ts    # Grid generation utilities
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── randomize.ts
│   │   ├── migrations.ts
│   │   └── backup.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── print.css
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/
│   │   ├── randomize.test.ts
│   │   └── migrations.test.ts
│   ├── components/
│   │   ├── Desk.test.tsx
│   │   └── ChartCanvas.test.tsx
│   └── e2e/
│       └── export.spec.ts
├── docs/
│   └── plans/
│       └── 2025-01-22-seating-chart-design.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---
