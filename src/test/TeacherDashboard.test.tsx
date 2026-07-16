import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';

// Mock supabase client before any component imports
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() })),
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));

import { TeacherDashboard } from '../components/home/TeacherDashboard';
import { ThemeProvider } from '../contexts/ThemeContext';

const render = (ui: ReactElement, options?: RenderOptions) =>
  rtlRender(ui, { wrapper: ThemeProvider, ...options });

// Phase 4: TeacherDashboard reads server data through the direct TanStack
// wrappers (useAppClassrooms + useCreateClassroom) instead of the dissolved
// useApp() facade. The mock layer moves accordingly; the assertions are
// preserved (the one exception — the create-call arg shape — is noted inline).
const mockUseAppClassrooms = vi.fn();
const mockUseActiveClassroom = vi.fn();
const mockCreateClassroom = vi.fn();
const mockUseCreateClassroom = vi.fn();
const mockSetActiveClassroom = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../hooks/useAppClassrooms', () => ({
  useAppClassrooms: () => mockUseAppClassrooms(),
  useActiveClassroom: () => mockUseActiveClassroom(),
}));

vi.mock('../hooks/useClassrooms', () => ({
  useCreateClassroom: () => mockUseCreateClassroom(),
}));

vi.mock('../contexts/useApp', () => ({
  useApp: () => ({ setActiveClassroom: mockSetActiveClassroom }),
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Default mock implementations — `useAppClassrooms` returns the camelCase
// app-shaped data TeacherDashboard expects (`{ classrooms, isLoading, error }`).
const defaultAppClassrooms = {
  classrooms: [],
  isLoading: false,
  error: null,
};

const defaultAuthContext = {
  user: { email: 'test@example.com', user_metadata: { name: 'Test Teacher' } },
};

describe('TeacherDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppClassrooms.mockReturnValue(defaultAppClassrooms);
    mockUseActiveClassroom.mockReturnValue({ activeClassroom: null });
    mockCreateClassroom.mockResolvedValue({ id: '1' });
    mockUseCreateClassroom.mockReturnValue({ mutateAsync: mockCreateClassroom, isPending: false });
    mockUseAuth.mockReturnValue(defaultAuthContext);
  });

  describe('Loading State', () => {
    it('should show loading spinner while data is loading', () => {
      mockUseAppClassrooms.mockReturnValue({ ...defaultAppClassrooms, isLoading: true });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state when useApp() has error', () => {
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        error: new Error('Failed to fetch data'),
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Unable to load dashboard')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('should show generic error message when error has no message', () => {
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        error: new Error(),
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show welcome screen when no classrooms exist', () => {
      mockUseAppClassrooms.mockReturnValue({ ...defaultAppClassrooms, classrooms: [] });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Welcome to ClassPoints!')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Create Your First Classroom/i })
      ).toBeInTheDocument();
    });

    it('should call createClassroom when create button is clicked', async () => {
      mockCreateClassroom.mockResolvedValue({ id: '1' });
      mockUseAppClassrooms.mockReturnValue({ ...defaultAppClassrooms, classrooms: [] });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /Create Your First Classroom/i }));

      // Phase 4: TeacherDashboard now calls useCreateClassroom().mutateAsync,
      // whose input is `{ name }` (vs the old `createClassroom(name)` string arg).
      expect(mockCreateClassroom).toHaveBeenCalledWith({ name: 'New Classroom' });
    });

    it('should show error when createClassroom fails', async () => {
      mockCreateClassroom.mockResolvedValue(null);
      mockUseAppClassrooms.mockReturnValue({ ...defaultAppClassrooms, classrooms: [] });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /Create Your First Classroom/i }));

      expect(
        await screen.findByText('Failed to create classroom. Please try again.')
      ).toBeInTheDocument();
    });

    it('disables the create button while a create is pending (double-tap guard)', () => {
      mockUseCreateClassroom.mockReturnValue({ mutateAsync: mockCreateClassroom, isPending: true });
      mockUseAppClassrooms.mockReturnValue({ ...defaultAppClassrooms, classrooms: [] });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByRole('button', { name: /Create Your First Classroom/i })).toBeDisabled();
    });
  });

  describe('Dashboard with Classrooms', () => {
    const classroomsWithData = [
      {
        id: '1',
        name: 'Class A',
        students: [
          {
            id: 's1',
            name: 'Student 1',
            pointTotal: 50,
            positiveTotal: 60,
            negativeTotal: -10,
            todayTotal: 5,
            thisWeekTotal: 20,
          },
          {
            id: 's2',
            name: 'Student 2',
            pointTotal: 30,
            positiveTotal: 30,
            negativeTotal: 0,
            todayTotal: 10,
            thisWeekTotal: 15,
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pointTotal: 80,
        todayTotal: 15,
      },
      {
        id: '2',
        name: 'Class B',
        students: [
          {
            id: 's3',
            name: 'Student 3',
            pointTotal: 25,
            positiveTotal: 25,
            negativeTotal: 0,
            todayTotal: 0,
            thisWeekTotal: 10,
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pointTotal: 25,
        todayTotal: 0,
      },
    ];

    it('should display welcome message with teacher name', () => {
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        classrooms: classroomsWithData,
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText(/Welcome back, Test Teacher!/)).toBeInTheDocument();
    });

    it('should calculate and display correct aggregate statistics', () => {
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        classrooms: classroomsWithData,
      });
      // "Points Today" reads the active classroom's live todayTotal (only the
      // active classroom ever carried time totals, pre- and post-dissolve).
      mockUseActiveClassroom.mockReturnValue({ activeClassroom: { todayTotal: 15 } });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      // Total points: 80 + 25 = 105
      expect(screen.getByText('+105')).toBeInTheDocument();

      // Total students: 2 + 1 = 3
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('across 2 classes')).toBeInTheDocument();

      // Today points: active classroom's todayTotal = 15
      expect(screen.getByText('+15')).toBeInTheDocument();
    });

    it('should display classroom cards', () => {
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        classrooms: classroomsWithData,
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Class A')).toBeInTheDocument();
      expect(screen.getByText('Class B')).toBeInTheDocument();
    });

    it('should call onSelectClassroom when classroom card is clicked', async () => {
      const onSelectClassroom = vi.fn();
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        classrooms: classroomsWithData,
      });

      render(<TeacherDashboard onSelectClassroom={onSelectClassroom} />);

      // Find the Class A button and click it
      const classAButton = screen.getByRole('button', { name: /Class A/i });
      await userEvent.click(classAButton);

      expect(onSelectClassroom).toHaveBeenCalledWith('1');
    });

    it('disables the phone "+ New classroom" button while a create is pending', () => {
      mockUseCreateClassroom.mockReturnValue({ mutateAsync: mockCreateClassroom, isPending: true });
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        classrooms: classroomsWithData,
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByRole('button', { name: /New classroom/i })).toBeDisabled();
    });
  });

  describe('User Display Name', () => {
    it('should use metadata name if available', () => {
      mockUseAuth.mockReturnValue({
        user: { email: 'test@example.com', user_metadata: { name: 'John Doe' } },
      });
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        classrooms: [{ id: '1', name: 'Test', students: [], createdAt: 0, updatedAt: 0 }],
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText(/Welcome back, John Doe!/)).toBeInTheDocument();
    });

    it('should fallback to email username if no metadata name', () => {
      mockUseAuth.mockReturnValue({
        user: { email: 'teacher@school.edu', user_metadata: {} },
      });
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        classrooms: [{ id: '1', name: 'Test', students: [], createdAt: 0, updatedAt: 0 }],
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText(/Welcome back, teacher!/)).toBeInTheDocument();
    });

    it('should fallback to "Teacher" if no user info', () => {
      mockUseAuth.mockReturnValue({ user: null });
      mockUseAppClassrooms.mockReturnValue({
        ...defaultAppClassrooms,
        classrooms: [{ id: '1', name: 'Test', students: [], createdAt: 0, updatedAt: 0 }],
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText(/Welcome back, Teacher!/)).toBeInTheDocument();
    });
  });
});
