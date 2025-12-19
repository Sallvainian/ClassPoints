import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Input, Modal } from '../ui';

export function Sidebar() {
  const { classrooms, activeClassroomId, setActiveClassroom, createClassroom } = useApp();
  const { user, signOut } = useAuth();
  const { isChristmas } = useTheme();
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
    <aside className={`w-64 text-white flex flex-col h-full transition-all duration-300 ${
      isChristmas
        ? 'christmas-gradient-sidebar'
        : 'bg-linear-to-b from-blue-600 to-blue-700'
    }`}>
      {/* Logo/Title */}
      <div className={`p-4 border-b ${isChristmas ? 'border-white/20' : 'border-blue-500'}`}>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className={`text-2xl ${isChristmas ? 'animate-jingle' : ''}`}>
            {isChristmas ? '🎅' : '🎯'}
          </span>
          ClassPoints
          {isChristmas && <span className="text-sm animate-star-sparkle">⭐</span>}
        </h1>
        <p className={`text-xs mt-1 ${isChristmas ? 'text-green-200' : 'text-blue-200'}`}>
          {isChristmas ? 'Holiday Edition' : 'Behavior Tracker'}
        </p>
      </div>

      {/* Create Button */}
      <div className="p-4">
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className={`w-full text-white border-0 transition-all ${
            isChristmas
              ? 'bg-white/20 hover:bg-gold-500/30 hover:shadow-lg'
              : 'bg-white/20 hover:bg-white/30'
          }`}
          size="sm"
        >
          {isChristmas ? '🎁 New Classroom' : '+ New Classroom'}
        </Button>
      </div>

      {/* Classroom List */}
      <nav className="flex-1 overflow-y-auto px-2">
        {classrooms.length === 0 ? (
          <p className={`text-sm px-2 text-center py-4 ${isChristmas ? 'text-green-200' : 'text-blue-200'}`}>
            {isChristmas ? '🎄 No classrooms yet' : 'No classrooms yet'}
          </p>
        ) : (
          <ul className="space-y-1">
            {classrooms.map((classroom) => {
              const pointTotal = classroom.pointTotal ?? 0;
              const positiveTotal = classroom.positiveTotal;
              const negativeTotal = classroom.negativeTotal;
              const hasBreakdown = positiveTotal !== undefined && negativeTotal !== undefined;
              return (
                <li key={classroom.id}>
                  <button
                    onClick={() => setActiveClassroom(classroom.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                      activeClassroomId === classroom.id
                        ? isChristmas
                          ? 'bg-white/30 text-white font-medium shadow-inner festive-glow-gold'
                          : 'bg-white/25 text-white font-medium shadow-inner'
                        : isChristmas
                          ? 'hover:bg-white/15 text-green-100'
                          : 'hover:bg-white/10 text-blue-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        {isChristmas && activeClassroomId === classroom.id && '🎄 '}
                        {classroom.name}
                      </span>
                      <div className="flex flex-col items-end ml-2">
                        <span
                          className={`text-xs font-medium ${
                            isChristmas
                              ? pointTotal >= 0 ? 'text-yellow-300' : 'text-red-300'
                              : pointTotal >= 0 ? 'text-emerald-300' : 'text-red-300'
                          }`}
                        >
                          {pointTotal >= 0 ? '+' : ''}{pointTotal}
                        </span>
                        {hasBreakdown && (
                          <span className={`text-[10px] ${isChristmas ? 'text-green-200' : 'text-blue-200'}`}>
                            <span className={isChristmas ? 'text-yellow-300/80' : 'text-emerald-300/80'}>+{positiveTotal}</span>
                            {' / '}
                            <span className="text-red-300/80">{negativeTotal}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs block mt-0.5 ${isChristmas ? 'text-green-200' : 'text-blue-200'}`}>
                      {classroom.students.length} student{classroom.students.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* User Account Section */}
      <div className={`p-4 border-t ${isChristmas ? 'border-white/20' : 'border-blue-500'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            isChristmas ? 'bg-yellow-500/30' : 'bg-white/20'
          }`}>
            {isChristmas ? '🎅' : displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <p className={`text-xs truncate ${isChristmas ? 'text-green-200' : 'text-blue-200'}`}>{userEmail}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
            isChristmas
              ? 'text-green-200 hover:text-white hover:bg-white/15'
              : 'text-blue-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>{isChristmas ? '🛷' : '🚪'}</span>
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
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
