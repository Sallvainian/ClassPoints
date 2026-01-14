import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Mock the contexts
const mockUseApp = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../contexts/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Default mock implementations
const defaultAppContext = {
  classrooms: [],
  createClassroom: vi.fn(),
  loading: false,
  error: null,
};

const defaultAuthContext = {
  user: { email: 'test@example.com', user_metadata: { name: 'Test Teacher' } },
};

describe('TeacherDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue(defaultAppContext);
    mockUseAuth.mockReturnValue(defaultAuthContext);
  });

  describe('Loading State', () => {
    it('should show loading spinner while data is loading', () => {
      mockUseApp.mockReturnValue({ ...defaultAppContext, loading: true });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state when useApp() has error', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        error: new Error('Failed to fetch data'),
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Unable to load dashboard')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('should show generic error message when error has no message', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        error: new Error(),
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show welcome screen when no classrooms exist', () => {
      mockUseApp.mockReturnValue({ ...defaultAppContext, classrooms: [] });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Welcome to ClassPoints!')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Create Your First Classroom/i })
      ).toBeInTheDocument();
    });

    it('should call createClassroom when create button is clicked', async () => {
      const createClassroom = vi.fn().mockResolvedValue({ id: '1' });
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: [],
        createClassroom,
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /Create Your First Classroom/i }));

      expect(createClassroom).toHaveBeenCalledWith('New Classroom');
    });

    it('should show error when createClassroom fails', async () => {
      const createClassroom = vi.fn().mockResolvedValue(null);
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: [],
        createClassroom,
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /Create Your First Classroom/i }));

      expect(
        await screen.findByText('Failed to create classroom. Please try again.')
      ).toBeInTheDocument();
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
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: classroomsWithData,
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText(/Welcome back, Test Teacher!/)).toBeInTheDocument();
    });

    it('should calculate and display correct aggregate statistics', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: classroomsWithData,
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      // Total points: 80 + 25 = 105
      expect(screen.getByText('+105')).toBeInTheDocument();

      // Total students: 2 + 1 = 3
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('across 2 classes')).toBeInTheDocument();

      // Today points: 15 + 0 = 15
      expect(screen.getByText('+15')).toBeInTheDocument();
    });

    it('should display classroom cards', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: classroomsWithData,
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText('Class A')).toBeInTheDocument();
      expect(screen.getByText('Class B')).toBeInTheDocument();
    });

    it('should call onSelectClassroom when classroom card is clicked', async () => {
      const onSelectClassroom = vi.fn();
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: classroomsWithData,
      });

      render(<TeacherDashboard onSelectClassroom={onSelectClassroom} />);

      // Find the Class A button and click it
      const classAButton = screen.getByRole('button', { name: /Class A/i });
      await userEvent.click(classAButton);

      expect(onSelectClassroom).toHaveBeenCalledWith('1');
    });
  });

  describe('User Display Name', () => {
    it('should use metadata name if available', () => {
      mockUseAuth.mockReturnValue({
        user: { email: 'test@example.com', user_metadata: { name: 'John Doe' } },
      });
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: [{ id: '1', name: 'Test', students: [], createdAt: 0, updatedAt: 0 }],
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText(/Welcome back, John Doe!/)).toBeInTheDocument();
    });

    it('should fallback to email username if no metadata name', () => {
      mockUseAuth.mockReturnValue({
        user: { email: 'teacher@school.edu', user_metadata: {} },
      });
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: [{ id: '1', name: 'Test', students: [], createdAt: 0, updatedAt: 0 }],
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText(/Welcome back, teacher!/)).toBeInTheDocument();
    });

    it('should fallback to "Teacher" if no user info', () => {
      mockUseAuth.mockReturnValue({ user: null });
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        classrooms: [{ id: '1', name: 'Test', students: [], createdAt: 0, updatedAt: 0 }],
      });

      render(<TeacherDashboard onSelectClassroom={vi.fn()} />);

      expect(screen.getByText(/Welcome back, Teacher!/)).toBeInTheDocument();
    });
  });
});
