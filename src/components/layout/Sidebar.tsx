import { useState } from 'react';
import { Moon, Sun, Plus, LayoutDashboard, LogOut, User } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Input, Modal } from '../ui';

interface SidebarProps {
  onNavigateHome?: () => void;
  onNavigateProfile?: () => void;
  onSelectClassroom?: (classroomId: string) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
      {children}
    </p>
  );
}

export function Sidebar({ onNavigateHome, onNavigateProfile, onSelectClassroom }: SidebarProps) {
  const { classrooms, activeClassroomId, setActiveClassroom, createClassroom } = useApp();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClassroomName, setNewClassroomName] = useState('');

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';

  const handleCreateClassroom = () => {
    if (newClassroomName.trim()) {
      createClassroom(newClassroomName.trim());
      setNewClassroomName('');
      setIsCreateModalOpen(false);
    }
  };

  return (
    <aside className="w-64 bg-surface-2 border-r border-hairline flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 border-b border-hairline">
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-2 h-2 rounded-full bg-accent-500" aria-hidden="true" />
          <h1 className="font-display text-2xl tracking-[-0.01em] text-ink-strong leading-none">
            ClassPoints
          </h1>
        </div>
        <p className="mt-1.5 ml-[18px] font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Behavior · K-12
        </p>
      </div>

      {/* Nav */}
      <div className="px-2 pt-3">
        <button
          onClick={() => onNavigateHome?.()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={1.75} />
          Dashboard
        </button>
      </div>

      {/* Classrooms section */}
      <div className="px-2 pt-3 pb-2 flex items-center justify-between">
        <SectionLabel>Classrooms</SectionLabel>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="mr-1 inline-flex items-center justify-center w-6 h-6 rounded-md text-ink-mid hover:bg-surface-3 hover:text-accent-600 transition-colors"
          aria-label="Create classroom"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {classrooms.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-ink-muted">No classrooms yet.</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 text-xs text-accent-600 hover:text-accent-700 underline-offset-4 hover:underline"
            >
              Create your first
            </button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {classrooms.map((classroom) => {
              const isActive = classroom.id === activeClassroomId;
              const pointTotal = classroom.pointTotal ?? 0;
              const positiveTotal = classroom.positiveTotal;
              const negativeTotal = classroom.negativeTotal;
              const hasBreakdown = positiveTotal !== undefined && negativeTotal !== undefined;
              const studentCount = classroom.students.length;
              return (
                <li key={classroom.id}>
                  <button
                    onClick={() => {
                      if (onSelectClassroom) {
                        onSelectClassroom(classroom.id);
                      } else {
                        setActiveClassroom(classroom.id);
                      }
                    }}
                    className={`group relative w-full text-left px-3 py-2 rounded-[10px] transition-colors ${
                      isActive
                        ? 'bg-surface-3 text-ink-strong'
                        : 'hover:bg-surface-3/60 text-ink-mid hover:text-ink-strong'
                    }`}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-accent-500"
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium truncate">{classroom.name}</span>
                      {!Number.isNaN(pointTotal) && (
                        <span
                          className={`font-mono tabular-nums text-[11px] font-semibold ${
                            pointTotal >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {pointTotal >= 0 ? '+' : ''}
                          {pointTotal}
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-0.5 flex items-center justify-between font-mono text-[10px] tracking-[0.04em] text-ink-muted"
                      style={{ minHeight: '14px' }}
                    >
                      <span>
                        {studentCount} student{studentCount !== 1 ? 's' : ''}
                      </span>
                      {isActive && hasBreakdown && (
                        <span className="tabular-nums">
                          <span className="text-emerald-600/80 dark:text-emerald-400/80">
                            +{positiveTotal}
                          </span>
                          <span className="mx-1 text-ink-muted/60">/</span>
                          <span className="text-red-600/80 dark:text-red-400/80">
                            {negativeTotal}
                          </span>
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Footer: theme + profile + signout */}
      <div className="border-t border-hairline p-3 space-y-1">
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
          ) : (
            <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
          )}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        <button
          onClick={() => onNavigateProfile?.()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] hover:bg-surface-3 transition-colors"
        >
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent-500/10 text-accent-700 dark:text-accent-400 text-xs font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-ink-strong truncate leading-tight">
              {displayName}
            </p>
            <p className="font-mono text-[10px] tracking-[0.04em] text-ink-muted truncate leading-tight mt-0.5">
              {userEmail}
            </p>
          </div>
          <User className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
        </button>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
          Sign out
        </button>
      </div>

      {/* Create Classroom Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New classroom"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateClassroom();
          }}
          className="space-y-5"
        >
          <Input
            label="Classroom Name"
            value={newClassroomName}
            onChange={(e) => setNewClassroomName(e.target.value)}
            placeholder="e.g. 3rd Period Science"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newClassroomName.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </aside>
  );
}
