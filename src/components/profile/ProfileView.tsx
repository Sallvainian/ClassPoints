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

export function ProfileView({ onClose }: ProfileViewProps) {
  const { user, updatePassword } = useAuth();
  const { classrooms, deleteClassroom, activeClassroomId, setActiveClassroom } = useApp();

  // Display name editing
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Classroom deletion
  const [classroomToDelete, setClassroomToDelete] = useState<Classroom | null>(null);

  // Auto-clear success messages with proper cleanup
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
    // If deleting the active classroom, clear it first
    if (classroomId === activeClassroomId) {
      setActiveClassroom(null);
    }
    deleteClassroom(classroomId);
    setClassroomToDelete(null);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Profile</h1>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* User Info Section */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Account Information</h2>
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            {/* Avatar and Email */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-medium">
                {currentDisplayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">{currentDisplayName}</p>
                <p className="text-sm text-gray-500">{userEmail}</p>
              </div>
            </div>

            {/* Display Name Edit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              {isEditingName ? (
                <div className="flex gap-2">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveDisplayName();
                      if (e.key === 'Escape') {
                        setDisplayName(currentDisplayName);
                        setIsEditingName(false);
                      }
                    }}
                  />
                  <Button onClick={handleSaveDisplayName} disabled={nameSaving}>
                    {nameSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDisplayName(currentDisplayName);
                      setIsEditingName(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-900">{currentDisplayName}</span>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingName(true)}>
                    Edit
                  </Button>
                </div>
              )}
              {nameError && <p className="text-sm text-red-600 mt-1">{nameError}</p>}
              {nameSuccess && <p className="text-sm text-green-600 mt-1">Display name updated!</p>}
            </div>

            {/* Password Change */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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
                    <p className="text-sm text-red-600">Passwords do not match</p>
                  )}
                  {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleChangePassword}
                      disabled={
                        passwordSaving ||
                        !newPassword ||
                        !confirmPassword ||
                        newPassword !== confirmPassword
                      }
                    >
                      {passwordSaving ? 'Updating...' : 'Update Password'}
                    </Button>
                    <Button
                      variant="ghost"
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
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">••••••••</span>
                  <Button variant="ghost" size="sm" onClick={() => setShowPasswordForm(true)}>
                    Change
                  </Button>
                </div>
              )}
              {passwordSuccess && <p className="text-sm text-green-600 mt-1">Password updated!</p>}
            </div>
          </div>
        </section>

        {/* Classrooms Section */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Your Classrooms ({classrooms.length})
          </h2>

          {classrooms.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-gray-500">No classrooms yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Create a classroom from the sidebar to get started.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg divide-y">
              {classrooms.map((classroom) => (
                <div
                  key={classroom.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{classroom.name}</p>
                    <p className="text-sm text-gray-500">
                      {classroom.students.length} student
                      {classroom.students.length !== 1 ? 's' : ''}
                      {classroom.pointTotal !== undefined && (
                        <span className="ml-2">
                          •{' '}
                          <span
                            className={
                              classroom.pointTotal >= 0 ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            <span className="sr-only">
                              {classroom.pointTotal >= 0 ? 'positive' : 'negative'}{' '}
                            </span>
                            {classroom.pointTotal >= 0 ? '+' : ''}
                            {classroom.pointTotal} points
                          </span>
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setClassroomToDelete(classroom)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Delete Classroom Modal */}
      <DeleteClassroomModal
        classroom={classroomToDelete}
        isOpen={classroomToDelete !== null}
        onClose={() => setClassroomToDelete(null)}
        onConfirm={handleDeleteClassroom}
      />
    </div>
  );
}
