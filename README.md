# ClassPoints

A classroom behavior management web app for teachers to track student points.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Styling:** Tailwind CSS v4

## Prerequisites

- Node.js 18+ (tested with v24.11.1)
- npm 9+ (tested with v11.6.2)

## Quick Start

```bash
# Clone and install
git clone https://github.com/YOUR_ORG/ClassPoints.git
cd ClassPoints
npm install

# Start development server
npm run dev
```

Open http://localhost:5173

## Development

For detailed code conventions, patterns, and architecture, see [CLAUDE.md](./CLAUDE.md).

### Commands

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `npm run dev`       | Start dev server             |
| `npm run build`     | Production build             |
| `npm run lint`      | Check for lint issues        |
| `npm run lint:fix`  | Fix lint issues              |
| `npm run format`    | Format all files             |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test`      | Run unit tests               |
| `npm run test:e2e`  | Run E2E tests                |

### Pre-commit Hooks

Code quality checks run automatically on commit:

- ESLint (TypeScript linting)
- Prettier (code formatting)
- TypeScript (type checking)

See [CLAUDE.md#Pre-commit Hooks](./CLAUDE.md#pre-commit-hooks) for details.

## Environment Setup

This project uses **dotenvx** for encrypted environment variables.

**For existing team members:** Request the `.env.keys` file from a team lead (contains decryption key).

**For new Supabase setup:** Copy `.env.example` to `.env.local` and configure your own Supabase credentials. See [CLAUDE.md#Environment Variables](./CLAUDE.md#environment-variables) for details.

## License

Private project - all rights reserved.
