import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { Button, Input } from '../ui';
import { DeleteClassroomModal } from './DeleteClassroomModal';
import type { Classroom } from '../../types';

const MIN_PASSWORD_LENGTH = 6;

interface ProfileViewProps {
  onClose: () => void;
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
      {children}
      {count !== undefined && (
        <span className="ml-2 text-ink-mid normal-case tracking-normal">{count}</span>
      )}
    </p>
  );
}

export function ProfileView({ onClose }: ProfileViewProps) {
  const { user, updatePassword } = useAuth();
  const { classrooms, deleteClassroom, activeClassroomId, setActiveClassroom } = useApp();

  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [classroomToDelete, setClassroomToDelete] = useState<Classroom | null>(null);

  useEffect(() => {
    if (nameSuccess) {
      const timeoutId = setTimeout(() => setNameSuccess(false), 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [nameSuccess]);

  useEffect(() => {
    if (passwordSuccess) {
      const timeoutId = setTimeout(() => setPasswordSuccess(false), 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [passwordSuccess]);

  const userEmail = user?.email || '';
  const currentDisplayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  const handleSaveDisplayName = async () => {
    if (!displayName.trim() || displayName.trim() === currentDisplayName) {
      setIsEditingName(false);
      return;
    }

    setNameSaving(true);
    setNameError(null);
    setNameSuccess(false);

    const { error } = await supabase.auth.updateUser({
      data: { name: displayName.trim() },
    });

    setNameSaving(false);

    if (error) {
      setNameError(error.message);
    } else {
      setNameSuccess(true);
      setIsEditingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    const { success, error } = await updatePassword(newPassword);

    setPasswordSaving(false);

    if (!success && error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    }
  };

  const handleDeleteClassroom = (classroomId: string) => {
    if (classroomId === activeClassroomId) {
      setActiveClassroom(null);
    }
    deleteClassroom(classroomId);
    setClassroomToDelete(null);
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 text-ink-strong overflow-hidden">
      {/* Header */}
      <header className="bg-surface-2 border-b border-hairline px-6 lg:px-10 py-5 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-1">
            Account
          </p>
          <h1 className="font-display text-3xl tracking-[-0.02em] leading-tight text-ink-strong">
            Profile
          </h1>
        </div>
        <button
          onClick={onClose}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mid hover:text-accent-600 transition-colors"
        >
          Done →
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10 space-y-12">
          {/* Identity */}
          <section>
            <SectionLabel>Identity</SectionLabel>
            <div className="bg-surface-2 border border-hairline rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-500/10 text-accent-700 dark:text-accent-400 text-xl font-semibold">
                  {currentDisplayName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-xl tracking-[-0.01em] text-ink-strong leading-tight truncate">
                    {currentDisplayName}
                  </p>
                  <p className="mt-0.5 font-mono text-xs tracking-[0.04em] text-ink-muted truncate">
                    {userEmail}
                  </p>
                </div>
              </div>

              <div className="border-t border-hairline pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted mb-2">
                  Display name
                </p>
                {isEditingName ? (
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDisplayName();
                          if (e.key === 'Escape') {
                            setDisplayName(currentDisplayName);
                            setIsEditingName(false);
                          }
                        }}
                      />
                    </div>
                    <Button onClick={handleSaveDisplayName} disabled={nameSaving} size="sm">
                      {nameSaving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDisplayName(currentDisplayName);
                        setIsEditingName(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-ink-strong">{currentDisplayName}</span>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-600 hover:text-accent-700 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
                {nameError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">{nameError}</p>
                )}
                {nameSuccess && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                    Display name updated.
                  </p>
                )}
              </div>

              <div className="border-t border-hairline pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted mb-2">
                  Password
                </p>
                {showPasswordForm ? (
                  <div className="space-y-3">
                    <Input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Passwords do not match
                      </p>
                    )}
                    {passwordError && (
                      <p className="text-xs text-red-600 dark:text-red-400">{passwordError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleChangePassword}
                        size="sm"
                        disabled={
                          passwordSaving ||
                          !newPassword ||
                          !confirmPassword ||
                          newPassword !== confirmPassword
                        }
                      >
                        {passwordSaving ? 'Updating…' : 'Update password'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setNewPassword('');
                          setConfirmPassword('');
                          setPasswordError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-mono tracking-[0.2em] text-ink-mid">••••••••</span>
                    <button
                      onClick={() => setShowPasswordForm(true)}
                      className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-600 hover:text-accent-700 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )}
                {passwordSuccess && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                    Password updated.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Classrooms */}
          <section>
            <SectionLabel count={classrooms.length}>Classrooms</SectionLabel>
            {classrooms.length === 0 ? (
              <div className="bg-surface-2 border border-hairline rounded-2xl p-10 text-center">
                <p className="font-display text-2xl tracking-[-0.01em] text-ink-strong leading-tight">
                  No classrooms yet.
                </p>
                <p className="mt-2 text-sm text-ink-mid">
                  Create one from the sidebar to get started.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {classrooms.map((classroom) => {
                  const total = classroom.pointTotal;
                  const hasTotal = total !== undefined && !Number.isNaN(total);
                  const isPositive = (total ?? 0) >= 0;
                  return (
                    <li
                      key={classroom.id}
                      className="bg-surface-2 border border-hairline rounded-2xl p-5 flex items-center justify-between gap-4 transition-colors hover:border-accent-500/30"
                    >
                      <div className="min-w-0">
                        <h3 className="font-display text-xl tracking-[-0.01em] text-ink-strong leading-tight truncate">
                          {classroom.name}
                        </h3>
                        <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-ink-muted">
                          {classroom.students.length} student
                          {classroom.students.length !== 1 ? 's' : ''}
                          {hasTotal && (
                            <>
                              {' · '}
                              <span
                                className={`tabular-nums font-semibold ${
                                  isPositive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {isPositive ? '+' : ''}
                                {total}
                              </span>{' '}
                              total
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => setClassroomToDelete(classroom)}
                        className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <DeleteClassroomModal
        classroom={classroomToDelete}
        isOpen={classroomToDelete !== null}
        onClose={() => setClassroomToDelete(null)}
        onConfirm={handleDeleteClassroom}
      />
    </div>
  );
}
