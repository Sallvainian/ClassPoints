import { useState } from 'react';
import { useApp } from '../../contexts/useApp';
import { useTheme } from '../../contexts/useTheme';
import { resolveAvatarDisplay } from '../../hooks';
import { getAvatarColorForName } from '../../utils';
import { Button, Input, Modal } from '../ui';
import { ImportStudentsModal } from '../classes/ImportStudentsModal';
import { AdjustPointsModal } from './AdjustPointsModal';
import { ResetPointsModal } from './ResetPointsModal';

interface ClassSettingsViewProps {
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

export function ClassSettingsView({ onClose }: ClassSettingsViewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const {
    activeClassroom,
    updateClassroom,
    deleteClassroom,
    addStudent,
    addStudents,
    removeStudent,
    updateStudent,
    setActiveClassroom,
    adjustStudentPoints,
    resetClassroomPoints,
  } = useApp();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [studentToAdjust, setStudentToAdjust] = useState<{
    id: string;
    name: string;
    pointTotal: number;
  } | null>(null);
  const [newStudentName, setNewStudentName] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentName, setEditingStudentName] = useState('');
  const [classroomName, setClassroomName] = useState(activeClassroom?.name || '');

  if (!activeClassroom) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-1 p-8">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
            No selection
          </p>
          <p className="font-display text-3xl tracking-[-0.01em] text-ink-strong mb-6">
            No classroom selected.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const handleAddStudent = () => {
    if (newStudentName.trim()) {
      addStudent(activeClassroom.id, newStudentName.trim());
      setNewStudentName('');
    }
  };

  const handleImportStudents = (names: string[]) => {
    addStudents(activeClassroom.id, names);
  };

  const handleUpdateClassroomName = () => {
    if (classroomName.trim() && classroomName !== activeClassroom.name) {
      updateClassroom(activeClassroom.id, { name: classroomName.trim() });
    }
  };

  const handleDeleteClassroom = () => {
    deleteClassroom(activeClassroom.id);
    setActiveClassroom(null);
    setIsDeleteConfirmOpen(false);
    onClose();
  };

  const handleStartEditStudent = (studentId: string, name: string) => {
    setEditingStudentId(studentId);
    setEditingStudentName(name);
  };

  const handleSaveStudentEdit = () => {
    if (editingStudentId && editingStudentName.trim()) {
      updateStudent(activeClassroom.id, editingStudentId, { name: editingStudentName.trim() });
    }
    setEditingStudentId(null);
    setEditingStudentName('');
  };

  const handleCancelStudentEdit = () => {
    setEditingStudentId(null);
    setEditingStudentName('');
  };

  const sortedStudents = [...activeClassroom.students].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  return (
    <div className="h-full flex flex-col bg-surface-1 text-ink-strong overflow-hidden">
      {/* Header */}
      <header className="bg-surface-2 border-b border-hairline px-6 lg:px-10 py-5 flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-1">
            Classroom · settings
          </p>
          <h1 className="font-display text-3xl tracking-[-0.02em] leading-tight text-ink-strong truncate">
            {activeClassroom.name}
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
          {/* Name */}
          <section>
            <SectionLabel>Name</SectionLabel>
            <div className="bg-surface-2 border border-hairline rounded-2xl p-5">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Input value={classroomName} onChange={(e) => setClassroomName(e.target.value)} />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleUpdateClassroomName}
                  disabled={!classroomName.trim() || classroomName === activeClassroom.name}
                >
                  Save
                </Button>
              </div>
            </div>
          </section>

          {/* Roster */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel count={activeClassroom.students.length}>Roster</SectionLabel>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-600 hover:text-accent-700 transition-colors"
              >
                Import →
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddStudent();
              }}
              className="flex gap-2 mb-4"
            >
              <div className="flex-1">
                <Input
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Add new student..."
                />
              </div>
              <Button type="submit" disabled={!newStudentName.trim()}>
                Add
              </Button>
            </form>

            {sortedStudents.length === 0 ? (
              <div className="bg-surface-2 border border-hairline rounded-2xl p-8 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
                  Empty roster
                </p>
                <p className="text-sm text-ink-mid">No students yet. Add one above or import.</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {sortedStudents.map((student) => {
                  const rawColor = student.avatarColor || getAvatarColorForName(student.name);
                  const { bg, textClass } = resolveAvatarDisplay(rawColor, isDark);
                  const isEditing = editingStudentId === student.id;
                  const isPositive = student.pointTotal >= 0;
                  return (
                    <li
                      key={student.id}
                      className="bg-surface-2 border border-hairline rounded-xl px-4 py-3 transition-colors hover:border-hairline-strong"
                    >
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2 items-center">
                          <div className="flex-1 min-w-[200px]">
                            <Input
                              value={editingStudentName}
                              onChange={(e) => setEditingStudentName(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveStudentEdit();
                                if (e.key === 'Escape') handleCancelStudentEdit();
                              }}
                            />
                          </div>
                          <Button size="sm" onClick={handleSaveStudentEdit}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelStudentEdit}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${textClass}`}
                              style={{ backgroundColor: bg }}
                            >
                              {student.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-display text-base tracking-[-0.005em] text-ink-strong truncate leading-tight">
                                {student.name}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] tabular-nums tracking-[0.04em] text-ink-muted">
                                <span
                                  className={
                                    isPositive
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }
                                >
                                  {isPositive ? '+' : ''}
                                  {student.pointTotal}
                                </span>{' '}
                                points
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEditStudent(student.id, student.name)}
                              className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mid hover:text-ink-strong hover:bg-surface-3 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                setStudentToAdjust({
                                  id: student.id,
                                  name: student.name,
                                  pointTotal: student.pointTotal,
                                })
                              }
                              className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mid hover:text-ink-strong hover:bg-surface-3 rounded transition-colors"
                            >
                              Adjust
                            </button>
                            <button
                              onClick={() => removeStudent(activeClassroom.id, student.id)}
                              className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Danger Zone */}
          <section>
            <SectionLabel>Danger zone</SectionLabel>
            <div className="space-y-2">
              <div className="border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl p-5">
                <h3 className="font-display text-lg tracking-[-0.01em] text-amber-800 dark:text-amber-200 leading-tight">
                  Reset all points
                </h3>
                <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
                  Clear all point history. Student roster preserved.
                </p>
                <div className="mt-4">
                  <Button variant="secondary" size="sm" onClick={() => setIsResetModalOpen(true)}>
                    Reset all points
                  </Button>
                </div>
              </div>

              <div className="border border-red-200/60 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/30 rounded-2xl p-5">
                <h3 className="font-display text-lg tracking-[-0.01em] text-red-800 dark:text-red-200 leading-tight">
                  Delete classroom
                </h3>
                <p className="mt-1 text-sm text-red-800/80 dark:text-red-200/80">
                  Removes all students and point history. Cannot be undone.
                </p>
                <div className="mt-4">
                  <Button variant="danger" size="sm" onClick={() => setIsDeleteConfirmOpen(true)}>
                    Delete classroom
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ImportStudentsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportStudents}
      />

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Delete classroom?"
      >
        <p className="text-sm text-ink-mid mb-5">
          Delete <span className="font-medium text-ink-strong">"{activeClassroom.name}"</span>? This
          removes all {activeClassroom.students.length} student
          {activeClassroom.students.length !== 1 ? 's' : ''} and their point history.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setIsDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteClassroom}>
            Delete
          </Button>
        </div>
      </Modal>

      <AdjustPointsModal
        student={studentToAdjust}
        isOpen={studentToAdjust !== null}
        onClose={() => setStudentToAdjust(null)}
        onConfirm={async (studentId, targetPoints, note) => {
          await adjustStudentPoints(activeClassroom.id, studentId, targetPoints, note);
        }}
      />

      <ResetPointsModal
        classroom={activeClassroom}
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={async (classroomId) => {
          await resetClassroomPoints(classroomId);
        }}
      />
    </div>
  );
}
