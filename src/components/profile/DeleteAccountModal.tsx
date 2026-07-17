import { useState, useEffect } from 'react';
import { Button, Input, Modal } from '../ui';
import { useAuth } from '../../contexts/useAuth';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Type-to-confirm account deletion (mirrors DeleteClassroomModal; the confirm
 * string is the account email). Owns its mutation like the award modals do:
 * the pending/error lifecycle is modal-internal. On success the modal never
 * needs to close itself — signOut() flips AuthGuard to the login page, which
 * unmounts the whole profile tree.
 */
export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const { user, signOut } = useAuth();
  const deleteAccountMutation = useDeleteAccount();
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // TEMP(set-state-in-effect): inline disable is temporary, pending a refactor
      // to a key-reset remount or deriving during render (react.dev: You Might Not
      // Need an Effect). Remove the disable when the refactor lands.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmationText('');
      setDeleteError(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  const email = user?.email ?? '';
  if (!email) return null;

  const isMatch = confirmationText === email;

  const handleConfirm = async () => {
    if (!isMatch || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccountMutation.mutateAsync();
      // Server side is gone; tear down the local session. auth-js ignores the
      // dead session's 401/403 on the sign-out endpoint, clears storage, and
      // emits SIGNED_OUT; AuthContext.signOut also clears the query cache.
      await signOut();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Account deletion failed');
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isMatch) {
      void handleConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={isDeleting ? () => undefined : onClose} title="Delete account?">
      <div className="space-y-5">
        <div className="rounded-[10px] border border-red-200/60 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/30 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400 mb-2">
            Permanent · cannot be undone
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mb-2">
            This will delete your account and all of its data:
          </p>
          <ul className="text-xs text-red-700 dark:text-red-300 ml-4 list-disc space-y-0.5">
            <li>Every classroom and its students</li>
            <li>All point history and transactions</li>
            <li>Seating charts, layouts, and settings</li>
          </ul>
        </div>

        {deleteError && (
          <div className="px-3 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs">
            {deleteError}
          </div>
        )}

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted mb-2">
            Type your email to confirm
          </p>
          <Input
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={email}
            autoFocus
            disabled={isDeleting}
            className={
              confirmationText.length > 0 && !isMatch
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : confirmationText.length > 0 && isMatch
                  ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                  : ''
            }
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!isMatch || isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete Account'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
