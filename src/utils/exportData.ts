/**
 * Export classroom data to CSV format
 */

import type { PointTransaction as DbPointTransaction } from '../types/database';

interface ExportStudent {
  id: string;
  name: string;
  avatarColor?: string;
  pointTotal: number;
  positiveTotal: number;
  negativeTotal: number;
}

interface ExportOptions {
  classroomName: string;
  students: ExportStudent[];
  transactions: DbPointTransaction[];
}

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If the value contains comma, quote, or newline, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format a timestamp as ISO date string
 */
function formatDate(timestamp: string | number): string {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Generate CSV content for students
 */
function generateStudentCSV(students: ExportStudent[]): string {
  const headers = ['Name', 'Total Points', 'Positive Points', 'Negative Points', 'Avatar Color'];
  const rows = students.map((s) => [
    escapeCSV(s.name),
    escapeCSV(s.pointTotal),
    escapeCSV(s.positiveTotal),
    escapeCSV(s.negativeTotal),
    escapeCSV(s.avatarColor),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Generate CSV content for transactions
 */
function generateTransactionCSV(
  transactions: DbPointTransaction[],
  studentMap: Map<string, string>
): string {
  const headers = ['Date', 'Student', 'Behavior', 'Points', 'Note'];
  const rows = transactions.map((t) => [
    escapeCSV(formatDate(t.created_at)),
    escapeCSV(studentMap.get(t.student_id) || 'Unknown'),
    escapeCSV(t.behavior_name),
    escapeCSV(t.points),
    escapeCSV(t.note),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Trigger a file download in the browser
 */
function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export classroom data to CSV files
 * Downloads two files: students.csv and transactions.csv
 */
export function exportClassroomToCSV(options: ExportOptions): void {
  const { classroomName, students, transactions } = options;
  const safeClassroomName = classroomName.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);

  // Create student name lookup map for transactions
  const studentMap = new Map(students.map((s) => [s.id, s.name]));

  // Generate and download students CSV
  const studentsCSV = generateStudentCSV(students);
  downloadFile(studentsCSV, `${safeClassroomName}_students_${timestamp}.csv`);

  // Generate and download transactions CSV if there are any
  if (transactions.length > 0) {
    const transactionsCSV = generateTransactionCSV(transactions, studentMap);
    downloadFile(transactionsCSV, `${safeClassroomName}_transactions_${timestamp}.csv`);
  }
}

/**
 * Export classroom data as a single combined CSV
 */
export function exportClassroomToCombinedCSV(options: ExportOptions): void {
  const { classroomName, students, transactions } = options;
  const safeClassroomName = classroomName.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);

  // Create student name lookup map
  const studentMap = new Map(students.map((s) => [s.id, s.name]));

  // Build combined content
  let content = `Classroom: ${classroomName}\n`;
  content += `Exported: ${new Date().toLocaleString()}\n\n`;

  // Students section
  content += '=== STUDENTS ===\n';
  content += generateStudentCSV(students);
  content += '\n\n';

  // Transactions section
  content += '=== POINT HISTORY ===\n';
  if (transactions.length > 0) {
    content += generateTransactionCSV(transactions, studentMap);
  } else {
    content += 'No transactions recorded\n';
  }

  downloadFile(content, `${safeClassroomName}_export_${timestamp}.csv`);
}
