import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { getAvatarColorForName } from '../../utils';
import { Button, Input, Modal } from '../ui';
import { ImportStudentsModal } from '../classes/ImportStudentsModal';

interface ClassSettingsViewProps {
  onClose: () => void;
}

export function ClassSettingsView({ onClose }: ClassSettingsViewProps) {
  const {
    activeClassroom,
    updateClassroom,
    deleteClassroom,
    addStudent,
    addStudents,
    removeStudent,
    updateStudent,
    setActiveClassroom,
  } = useApp();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentName, setEditingStudentName] = useState('');
  const [classroomName, setClassroomName] = useState(activeClassroom?.name || '');

  if (!activeClassroom) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No classroom selected</p>
        <Button variant="secondary" onClick={onClose} className="mt-4">
          Close
        </Button>
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

  // Sort students alphabetically
  const sortedStudents = [...activeClassroom.students].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Classroom Settings</h1>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Classroom Name Section */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Classroom Name</h2>
          <div className="flex gap-2">
            <Input
              value={classroomName}
              onChange={(e) => setClassroomName(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={handleUpdateClassroomName}
              disabled={!classroomName.trim() || classroomName === activeClassroom.name}
            >
              Save
            </Button>
          </div>
        </section>

        {/* Students Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Students ({activeClassroom.students.length})
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
            >
              Import
            </Button>
          </div>

          {/* Add Student Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddStudent();
            }}
            className="flex gap-2 mb-4"
          >
            <Input
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="Add new student..."
              className="flex-1"
            />
            <Button type="submit" disabled={!newStudentName.trim()}>
              Add
            </Button>
          </form>

          {/* Student List */}
          {sortedStudents.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              No students yet. Add some above or import from a file.
            </p>
          ) : (
            <ul className="border rounded-lg divide-y">
              {sortedStudents.map((student) => (
                <li
                  key={student.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  {editingStudentId === student.id ? (
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={editingStudentName}
                        onChange={(e) => setEditingStudentName(e.target.value)}
                        className="flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveStudentEdit();
                          if (e.key === 'Escape') handleCancelStudentEdit();
                        }}
                      />
                      <Button size="sm" onClick={handleSaveStudentEdit}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelStudentEdit}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: student.avatarColor || getAvatarColorForName(student.name) }}
                        >
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{student.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEditStudent(student.id, student.name)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => removeStudent(activeClassroom.id, student.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Danger Zone */}
        <section className="pt-4 border-t">
          <h2 className="text-sm font-semibold text-red-600 mb-3">Danger Zone</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-3">
              Deleting this classroom will remove all students and their point history.
              This action cannot be undone.
            </p>
            <Button
              variant="danger"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              Delete Classroom
            </Button>
          </div>
        </section>
      </div>

      {/* Import Modal */}
      <ImportStudentsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportStudents}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Delete Classroom?"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete "{activeClassroom.name}"? This will remove
          all {activeClassroom.students.length} students and their point history.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setIsDeleteConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteClassroom}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
