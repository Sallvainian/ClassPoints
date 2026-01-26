import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { getAvatarColorForName, exportClassroomToCombinedCSV } from '../../utils';
import { Button, Input, Modal } from '../ui';
import { ImportStudentsModal } from '../classes/ImportStudentsModal';
import { AdjustPointsModal } from './AdjustPointsModal';
import { ResetPointsModal } from './ResetPointsModal';

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
    adjustStudentPoints,
    resetClassroomPoints,
    getClassroomTransactions,
  } = useApp();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isClearStudentsOpen, setIsClearStudentsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  const handleExportData = () => {
    if (!activeClassroom) return;
    setIsExporting(true);
    try {
      const transactions = getClassroomTransactions(activeClassroom.id);
      exportClassroomToCombinedCSV({
        classroomName: activeClassroom.name,
        students: activeClassroom.students,
        transactions,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAllStudents = async () => {
    if (!activeClassroom) return;
    // Remove all students one by one (cascades to transactions via DB)
    for (const student of activeClassroom.students) {
      await removeStudent(activeClassroom.id, student.id);
    }
    setIsClearStudentsOpen(false);
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
            <Button variant="secondary" size="sm" onClick={() => setIsImportModalOpen(true)}>
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
                          style={{
                            backgroundColor:
                              student.avatarColor || getAvatarColorForName(student.name),
                          }}
                        >
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{student.name}</span>
                          <span
                            className={`text-sm ml-2 ${
                              student.pointTotal >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            <span className="sr-only">
                              {student.pointTotal >= 0 ? 'positive' : 'negative'}{' '}
                            </span>
                            ({student.pointTotal >= 0 ? '+' : ''}
                            {student.pointTotal} pts)
                          </span>
                        </div>
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
                          onClick={() =>
                            setStudentToAdjust({
                              id: student.id,
                              name: student.name,
                              pointTotal: student.pointTotal,
                            })
                          }
                        >
                          Adjust
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

        {/* Data Management */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Data Management</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">Export Classroom Data</h3>
            <p className="text-sm text-gray-600 mb-3">
              Download a CSV file containing all students and point history for this classroom.
            </p>
            <Button
              variant="secondary"
              onClick={handleExportData}
              disabled={isExporting || activeClassroom.students.length === 0}
            >
              {isExporting ? 'Exporting...' : 'Export to CSV'}
            </Button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="pt-4 border-t">
          <h2 className="text-sm font-semibold text-red-600 mb-3">Danger Zone</h2>

          {/* Reset Points */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-amber-800 mb-2">Reset All Points</h3>
            <p className="text-sm text-gray-700 mb-3">
              Clear all point history for this classroom. Student roster will be preserved.
            </p>
            <Button
              variant="secondary"
              className="border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={() => setIsResetModalOpen(true)}
            >
              Reset All Points
            </Button>
          </div>

          {/* Clear All Students */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-orange-800 mb-2">Clear All Students</h3>
            <p className="text-sm text-gray-700 mb-3">
              Remove all students from this classroom. The classroom will be preserved but all
              student data and point history will be deleted.
            </p>
            <Button
              variant="secondary"
              className="border-orange-300 text-orange-800 hover:bg-orange-100"
              onClick={() => setIsClearStudentsOpen(true)}
              disabled={activeClassroom.students.length === 0}
            >
              Clear All Students
            </Button>
          </div>

          {/* Delete Classroom */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-medium text-red-800 mb-2">Delete Classroom</h3>
            <p className="text-sm text-gray-700 mb-3">
              Deleting this classroom will remove all students and their point history. This action
              cannot be undone.
            </p>
            <Button variant="danger" onClick={() => setIsDeleteConfirmOpen(true)}>
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
          Are you sure you want to delete "{activeClassroom.name}"? This will remove all{' '}
          {activeClassroom.students.length} students and their point history.
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

      {/* Adjust Points Modal */}
      <AdjustPointsModal
        student={studentToAdjust}
        isOpen={studentToAdjust !== null}
        onClose={() => setStudentToAdjust(null)}
        onConfirm={async (studentId, targetPoints, note) => {
          await adjustStudentPoints(activeClassroom.id, studentId, targetPoints, note);
        }}
      />

      {/* Reset Points Modal */}
      <ResetPointsModal
        classroom={activeClassroom}
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={async (classroomId) => {
          await resetClassroomPoints(classroomId);
        }}
      />

      {/* Clear All Students Confirmation Modal */}
      <Modal
        isOpen={isClearStudentsOpen}
        onClose={() => setIsClearStudentsOpen(false)}
        title="Clear All Students?"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to remove all {activeClassroom.students.length} student
          {activeClassroom.students.length !== 1 ? 's' : ''} from "{activeClassroom.name}"? This
          will delete all student data and point history. The classroom itself will be preserved.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setIsClearStudentsOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleClearAllStudents}
            disabled={activeClassroom.students.length === 0}
          >
            Clear All Students
          </Button>
        </div>
      </Modal>
    </div>
  );
}
