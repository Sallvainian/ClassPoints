import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Button, Input, Modal } from '../ui';

export function Sidebar() {
  const { classrooms, activeClassroomId, setActiveClassroom, createClassroom } = useApp();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClassroomName, setNewClassroomName] = useState('');

  const handleCreateClassroom = () => {
    if (newClassroomName.trim()) {
      createClassroom(newClassroomName.trim());
      setNewClassroomName('');
      setIsCreateModalOpen(false);
    }
  };

  return (
    <aside className="w-64 bg-gradient-to-b from-blue-600 to-blue-700 text-white flex flex-col h-full">
      {/* Logo/Title */}
      <div className="p-4 border-b border-blue-500">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          ClassPoints
        </h1>
        <p className="text-xs text-blue-200 mt-1">Behavior Tracker</p>
      </div>

      {/* Create Button */}
      <div className="p-4">
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
          <p className="text-sm text-blue-200 px-2 text-center py-4">
            No classrooms yet
          </p>
        ) : (
          <ul className="space-y-1">
            {classrooms.map((classroom) => (
              <li key={classroom.id}>
                <button
                  onClick={() => setActiveClassroom(classroom.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                    activeClassroomId === classroom.id
                      ? 'bg-white/25 text-white font-medium shadow-inner'
                      : 'hover:bg-white/10 text-blue-100'
                  }`}
                >
                  <span className="block truncate">{classroom.name}</span>
                  <span className="text-xs text-blue-200 block mt-0.5">
                    {classroom.students.length} student{classroom.students.length !== 1 ? 's' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 text-xs text-blue-300 border-t border-blue-500">
        <p>Tap a student to award points</p>
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
