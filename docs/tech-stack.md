# ClassPoints Technology Stack

## Overview

ClassPoints is built with a modern React + Supabase stack, optimized for rapid development and real-time collaboration features.

## Frontend Stack

### Core Framework

| Technology     | Version | Purpose                   |
| -------------- | ------- | ------------------------- |
| **React**      | 18.3.1  | UI component library      |
| **TypeScript** | 5.6.2   | Static type checking      |
| **Vite**       | 6.0.5   | Build tool and dev server |

### Styling

| Technology       | Purpose                     |
| ---------------- | --------------------------- |
| **Tailwind CSS** | Utility-first CSS framework |
| **PostCSS**      | CSS processing              |

### State Management

| Technology        | Purpose                      |
| ----------------- | ---------------------------- |
| **React Context** | Application state management |
| **Custom Hooks**  | Reusable state logic         |
| **useReducer**    | Complex state updates        |

## Backend Stack (Supabase)

### Services Used

| Service                | Purpose                              |
| ---------------------- | ------------------------------------ |
| **PostgreSQL**         | Relational database                  |
| **Supabase Auth**      | User authentication (email/password) |
| **Supabase Realtime**  | Live data synchronization            |
| **Row Level Security** | Multi-tenant data isolation          |

### Database Features

- **Real-time subscriptions** via `postgres_changes`
- **RLS policies** for all tables
- **REPLICA IDENTITY FULL** for complete DELETE payloads
- **UUID primary keys** with auto-generation

## Development Tools

### Build & Dev

| Tool           | Purpose                               |
| -------------- | ------------------------------------- |
| **Vite**       | Fast HMR, optimized production builds |
| **ESLint**     | Code linting and style enforcement    |
| **TypeScript** | Type checking and IDE support         |

### Testing

| Tool                       | Purpose                             |
| -------------------------- | ----------------------------------- |
| **Vitest**                 | Unit testing (Vite-native, 4.0.13)  |
| **Playwright**             | End-to-end browser testing (1.57.0) |
| **@testing-library/react** | React component testing             |

### Version Control & CI/CD

| Tool               | Purpose             |
| ------------------ | ------------------- |
| **Git**            | Version control     |
| **GitHub**         | Repository hosting  |
| **GitHub Actions** | CI/CD pipeline      |
| **GitHub Pages**   | Static site hosting |

## Dependencies

### Production Dependencies

```json
{
  "@supabase/supabase-js": "^2.84.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "uuid": "^13.0.0"
}
```

### Development Dependencies

```json
{
  "@eslint/js": "^9.17.0",
  "@playwright/test": "^1.57.0",
  "@testing-library/react": "^16.3.0",
  "@types/react": "^18.3.18",
  "@types/react-dom": "^18.3.5",
  "@types/uuid": "^10.0.0",
  "@vitejs/plugin-react": "^4.3.4",
  "autoprefixer": "^10.4.22",
  "eslint": "^9.17.0",
  "eslint-plugin-react-hooks": "^5.0.0",
  "eslint-plugin-react-refresh": "^0.4.16",
  "globals": "^15.14.0",
  "postcss": "^8.5.6",
  "tailwindcss": "^4.1.17",
  "typescript": "~5.6.2",
  "typescript-eslint": "^8.18.2",
  "vite": "^6.0.5",
  "vitest": "^4.0.13"
}
```

## Configuration Files

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ClassPoints/', // GitHub Pages path
  server: {
    host: true, // Allow network access
  },
});
```

### TypeScript Configuration

```json
// tsconfig.json (project references)
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

### Tailwind Configuration

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Environment Variables

### Required Variables

| Variable                 | Description            |
| ------------------------ | ---------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL   |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Example `.env.local`

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## NPM Scripts

| Script     | Command                | Purpose                  |
| ---------- | ---------------------- | ------------------------ |
| `dev`      | `vite`                 | Start development server |
| `build`    | `tsc -b && vite build` | Production build         |
| `lint`     | `eslint .`             | Run ESLint               |
| `preview`  | `vite preview`         | Preview production build |
| `test`     | `vitest`               | Run unit tests           |
| `test:e2e` | `playwright test`      | Run E2E tests            |

## Browser Support

- Modern browsers (ES2020+)
- Chrome, Firefox, Safari, Edge (latest 2 versions)
- No IE11 support

## Performance Optimizations

### Build Optimizations

- Vite tree-shaking and code splitting
- CSS purging via Tailwind
- ES module output

### Runtime Optimizations

- React 18 Concurrent Mode
- Optimistic UI updates
- Efficient realtime subscriptions (per-table channels)

### Audio System

- **Web Audio API** for synthesized sound effects
- AudioContext with oscillator-based sound generation
- Configurable volume and sound types
- No external audio file dependencies

## Security Considerations

### Authentication

- Supabase Auth handles all auth flows
- JWT tokens with automatic refresh
- Secure session management

### Data Access

- Row Level Security on all tables
- No direct database credentials in client
- Server-side access control

### HTTPS

- Supabase endpoints are HTTPS-only
- GitHub Pages serves over HTTPS
