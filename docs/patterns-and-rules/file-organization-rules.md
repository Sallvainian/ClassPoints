# File Organization Rules

## Directory Structure

```
src/
├── components/        # UI components by feature
│   ├── auth/          # Authentication components
│   ├── behaviors/     # Behavior selection components
│   ├── classes/       # Classroom management
│   ├── common/        # Shared components
│   ├── dashboard/     # Main dashboard
│   ├── layout/        # Layout components (Sidebar, etc.)
│   ├── migration/     # Data migration wizard
│   ├── points/        # Point award/undo components
│   ├── settings/      # Settings views
│   ├── students/      # Student cards/grid
│   └── ui/            # Base UI components (Button, Modal, Input)
├── contexts/          # React Context providers
├── hooks/             # Custom React hooks
├── lib/               # Library configuration (supabase.ts)
├── services/          # Business logic services
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

**Rules:**

- Components organized by feature/domain, not by type
- Each feature folder has its own `index.ts` barrel export
- Base UI components go in `components/ui/`
- Shared/reusable components go in `components/common/`

## Import Order Convention

```tsx
// 1. React imports
import { useState, useEffect, useCallback } from 'react';

// 2. External libraries
import { supabase } from '../lib/supabase';

// 3. Internal contexts/hooks
import { useApp } from '../contexts/AppContext';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

// 4. Components
import { Modal } from '../components/ui';

// 5. Types
import type { Student, Classroom } from '../types/database';
```

---
