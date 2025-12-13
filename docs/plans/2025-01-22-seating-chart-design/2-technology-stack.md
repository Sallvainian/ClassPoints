# 2. Technology Stack

| Category     | Choice        | Rationale                                         |
| ------------ | ------------- | ------------------------------------------------- |
| Framework    | React 18+     | Component architecture suits interactive chart UI |
| Build Tool   | Vite          | Fast development, modern defaults                 |
| Language     | TypeScript    | Type safety for complex data models               |
| Styling      | Tailwind CSS  | Rapid UI development, utility-first               |
| Drag & Drop  | @dnd-kit/core | Modern, accessible, well-maintained               |
| Image Export | html2canvas   | DOM-to-image for PNG export                       |
| Testing      | Vitest + RTL  | Fast unit tests, React Testing Library            |
| E2E Testing  | Playwright    | Export functionality validation                   |

## Package Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "html2canvas": "^1.4.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "playwright": "^1.40.0"
  }
}
```

---
