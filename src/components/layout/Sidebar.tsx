import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input, Modal } from '../ui';

interface SidebarProps {
  onNavigateHome?: () => void;
  onNavigateProfile?: () => void;
  onSelectClassroom?: (classroomId: string) => void;
}

export function Sidebar({ onNavigateHome, onNavigateProfile, onSelectClassroom }: SidebarProps) {
  const { classrooms, activeClassroomId, setActiveClassroom, createClassroom } = useApp();
  const { user, signOut } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClassroomName, setNewClassroomName] = useState('');

  // Get display name from user metadata or email
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
    <aside className="w-64 bg-linear-to-b from-blue-600 to-blue-700 text-white flex flex-col h-full">
      {/* Logo/Title */}
      <div className="p-4 border-b border-blue-500">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          ClassPoints
        </h1>
        <p className="text-xs text-blue-200 mt-1">Behavior Tracker</p>
      </div>

      {/* Dashboard Navigation */}
      <div className="px-4 pt-4">
        <button
          onClick={() => onNavigateHome?.()}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-100 hover:bg-white/10 rounded-lg transition-colors"
        >
          <span>📊</span>
          Dashboard
        </button>
      </div>

      {/* Create Button */}
      <div className="p-4 pt-2">
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full bg-white/20 hover:bg-white/30 text-white border-0"
          size="sm"
        >
          + New Classroom
        </Button>
      </div>

      {/* Classroom List */}
      <nav className="flex-1 overflow-y-auto px-2">
        {classrooms.length === 0 ? (
          <p className="text-sm text-blue-200 px-2 text-center py-4">No classrooms yet</p>
        ) : (
          <ul className="space-y-1">
            {classrooms.map((classroom) => {
              // Use pre-calculated values from mappedClassrooms (single source of truth)
              const isActive = classroom.id === activeClassroomId;
              const pointTotal = classroom.pointTotal ?? 0;
              const positiveTotal = classroom.positiveTotal;
              const negativeTotal = classroom.negativeTotal;
              const hasBreakdown = positiveTotal !== undefined && negativeTotal !== undefined;
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
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isActive
                        ? 'bg-white/25 text-white font-medium shadow-inner'
                        : 'hover:bg-white/10 text-blue-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{classroom.name}</span>
                      <div className="flex flex-col items-end ml-2 font-normal">
                        {Number.isNaN(pointTotal) ? (
                          <span className="text-xs text-blue-200">...</span>
                        ) : (
                          <>
                            <span
                              className={`text-xs font-semibold ${
                                pointTotal >= 0 ? 'text-emerald-300' : 'text-red-300'
                              }`}
                            >
                              {pointTotal >= 0 ? '+' : ''}
                              {pointTotal}
                            </span>
                            {/* Always render breakdown container to prevent layout shift, only show content for active classroom */}
                            <span
                              className="text-[10px] text-blue-200 font-normal"
                              style={{ minHeight: '14px' }}
                            >
                              {isActive && hasBreakdown && (
                                <>
                                  <span className="text-emerald-300/80">+{positiveTotal}</span>
                                  {' / '}
                                  <span className="text-red-300/80">{negativeTotal}</span>
                                </>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-blue-200 block mt-0.5">
                      {classroom.students.length} student
                      {classroom.students.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* User Account Section */}
      <div className="p-4 border-t border-blue-500">
        <button
          onClick={() => onNavigateProfile?.()}
          className="w-full flex items-center gap-3 mb-3 p-2 -m-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <p className="text-xs text-blue-200 truncate">{userEmail}</p>
          </div>
        </button>
        <button
          onClick={signOut}
          className="w-full text-left px-3 py-2 text-sm text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>🚪</span>
          Sign Out
        </button>
      </div>

      {/* Create Classroom Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Classroom"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateClassroom();
          }}
        >
          <Input
            label="Classroom Name"
            value={newClassroomName}
            onChange={(e) => setNewClassroomName(e.target.value)}
            placeholder="e.g., 3rd Period Science"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
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
