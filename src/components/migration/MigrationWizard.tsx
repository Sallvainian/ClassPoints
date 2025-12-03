import { useState, useCallback } from 'react';
import { Button } from '../ui/Button';
import {
  hasLocalStorageData,
  getMigrationSummary,
  migrateToSupabase,
  clearLocalStorageAfterMigration,
  type MigrationResult,
  type MigrationProgress,
} from '../../utils/migrateToSupabase';

interface MigrationWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

type WizardStep = 'check' | 'preview' | 'migrating' | 'complete' | 'error';

export function MigrationWizard({ onComplete, onSkip }: MigrationWizardProps) {
  const [step, setStep] = useState<WizardStep>('check');
  const [progress, setProgress] = useState<MigrationProgress>({
    phase: 'idle',
    current: 0,
    total: 0,
    message: '',
  });
  const [result, setResult] = useState<MigrationResult | null>(null);

  const summary = getMigrationSummary();
  const hasData = hasLocalStorageData();

  const handleStartMigration = useCallback(async () => {
    setStep('migrating');

    const migrationResult = await migrateToSupabase(setProgress);
    setResult(migrationResult);

    if (migrationResult.success) {
      clearLocalStorageAfterMigration();
      setStep('complete');
    } else {
      setStep('error');
    }
  }, []);

  const getProgressPercentage = (): number => {
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getPhaseLabel = (phase: string): string => {
    switch (phase) {
      case 'exporting':
        return 'Exporting Data';
      case 'classrooms':
        return 'Migrating Classrooms';
      case 'students':
        return 'Migrating Students';
      case 'behaviors':
        return 'Migrating Behaviors';
      case 'transactions':
        return 'Migrating Transactions';
      case 'validating':
        return 'Validating';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      default:
        return 'Starting...';
    }
  };

  // Check step - determine if migration is needed
  if (step === 'check') {
    if (!hasData) {
      return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome!</h2>
            <p className="text-gray-600 mb-6">
              No existing data found. You're starting fresh with cloud sync enabled!
            </p>
            <Button onClick={onComplete} className="w-full">
              Get Started
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📦</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Data Migration</h2>
          <p className="text-gray-600 mb-6">
            We found existing data on this device. Would you like to migrate it to the cloud?
          </p>
          <Button onClick={() => setStep('preview')} className="w-full mb-3">
            Review & Migrate
          </Button>
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip (keep using local storage)
          </button>
        </div>
      </div>
    );
  }

  // Preview step - show what will be migrated
  if (step === 'preview') {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Migration Preview</h2>
        <p className="text-gray-600 mb-4">
          The following data will be migrated to your cloud account:
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Classrooms</span>
            <span className="font-semibold">{summary.classrooms}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Students</span>
            <span className="font-semibold">{summary.students}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Custom Behaviors</span>
            <span className="font-semibold">{summary.behaviors}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Point Transactions</span>
            <span className="font-semibold">{summary.transactions}</span>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> After migration, your data will sync across all your devices.
            A backup of your local data will be kept just in case.
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={handleStartMigration} className="w-full">
            Start Migration
          </Button>
          <button
            onClick={() => setStep('check')}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Migrating step - show progress
  if (step === 'migrating') {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Migrating Data...</h2>

        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">{getPhaseLabel(progress.phase)}</span>
            <span className="font-semibold">{getProgressPercentage()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">{progress.message}</p>
        </div>

        <div className="text-center text-gray-500 text-sm">
          Please don't close this window...
        </div>
      </div>
    );
  }

  // Complete step - show success
  if (step === 'complete' && result) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Migration Complete!</h2>
          <p className="text-gray-600 mb-6">
            Your data has been successfully migrated to the cloud.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Classrooms migrated</span>
            <span className="font-semibold text-green-600">{result.classroomsMigrated}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Students migrated</span>
            <span className="font-semibold text-green-600">{result.studentsMigrated}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Behaviors migrated</span>
            <span className="font-semibold text-green-600">{result.behaviorsMigrated}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Transactions migrated</span>
            <span className="font-semibold text-green-600">{result.transactionsMigrated}</span>
          </div>
        </div>

        {result.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <p className="text-sm font-medium text-yellow-800 mb-2">Warnings:</p>
            <ul className="text-sm text-yellow-700 space-y-1">
              {result.warnings.slice(0, 3).map((warning, i) => (
                <li key={i}>• {warning}</li>
              ))}
              {result.warnings.length > 3 && (
                <li className="text-yellow-600">
                  ...and {result.warnings.length - 3} more
                </li>
              )}
            </ul>
          </div>
        )}

        <Button onClick={onComplete} className="w-full">
          Continue to App
        </Button>
      </div>
    );
  }

  // Error step
  if (step === 'error' && result) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Migration Failed</h2>
          <p className="text-gray-600 mb-6">
            Some errors occurred during migration. Your local data is preserved.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 max-h-40 overflow-y-auto">
          <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
          <ul className="text-sm text-red-700 space-y-1">
            {result.errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
          <p className="text-sm text-gray-600">Partial migration results:</p>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Classrooms</span>
            <span className="font-semibold">{result.classroomsMigrated}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Students</span>
            <span className="font-semibold">{result.studentsMigrated}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={handleStartMigration} className="w-full">
            Retry Migration
          </Button>
          <button
            onClick={onSkip}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Continue without migration
          </button>
        </div>
      </div>
    );
  }

  return null;
}
