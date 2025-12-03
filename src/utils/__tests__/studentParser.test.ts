import { describe, it, expect } from 'vitest';
import { parseJSON, parseCSV, parseStudents } from '../studentParser';

describe('studentParser', () => {
  describe('parseJSON', () => {
    it('parses array of strings', () => {
      const result = parseJSON('["John", "Jane", "Bob"]');
      expect(result.names).toEqual(['John', 'Jane', 'Bob']);
      expect(result.errors).toHaveLength(0);
    });

    it('parses array of objects with name property', () => {
      const result = parseJSON('[{"name": "John"}, {"name": "Jane"}]');
      expect(result.names).toEqual(['John', 'Jane']);
      expect(result.errors).toHaveLength(0);
    });

    it('handles various name property keys', () => {
      const result = parseJSON('[{"Name": "John"}, {"student": "Jane"}, {"fullName": "Bob"}]');
      expect(result.names).toEqual(['John', 'Jane', 'Bob']);
    });

    it('trims whitespace from names', () => {
      const result = parseJSON('["  John  ", "Jane  "]');
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('skips empty strings', () => {
      const result = parseJSON('["John", "", "Jane"]');
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('returns error for invalid JSON', () => {
      const result = parseJSON('not valid json');
      expect(result.names).toHaveLength(0);
      expect(result.errors).toContain('Invalid JSON format');
    });

    it('returns error for non-array JSON', () => {
      const result = parseJSON('{"name": "John"}');
      expect(result.names).toHaveLength(0);
      expect(result.errors).toContain('JSON must be an array');
    });
  });

  describe('parseCSV', () => {
    it('parses simple list of names', () => {
      const result = parseCSV('John\nJane\nBob');
      expect(result.names).toEqual(['John', 'Jane', 'Bob']);
      expect(result.errors).toHaveLength(0);
    });

    it('handles Windows line endings', () => {
      const result = parseCSV('John\r\nJane\r\nBob');
      expect(result.names).toEqual(['John', 'Jane', 'Bob']);
    });

    it('skips header row when detected', () => {
      const result = parseCSV('name\nJohn\nJane');
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('handles CSV with multiple columns', () => {
      const result = parseCSV('name,email,grade\nJohn,john@test.com,A\nJane,jane@test.com,B');
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('handles quoted values with commas', () => {
      const result = parseCSV('name,notes\n"Smith, John",good\n"Doe, Jane",excellent');
      expect(result.names).toEqual(['Smith, John', 'Doe, Jane']);
    });

    it('trims whitespace', () => {
      const result = parseCSV('  John  \n  Jane  ');
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('skips empty lines', () => {
      const result = parseCSV('John\n\nJane\n\n');
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('returns error for empty content', () => {
      const result = parseCSV('');
      expect(result.errors).toContain('CSV file is empty');
    });
  });

  describe('parseStudents (auto-detect)', () => {
    it('detects JSON format from content', () => {
      const result = parseStudents('["John", "Jane"]');
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('detects CSV format from content', () => {
      const result = parseStudents('John\nJane');
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('uses filename extension for JSON', () => {
      const result = parseStudents('["John"]', 'students.json');
      expect(result.names).toEqual(['John']);
    });

    it('uses filename extension for CSV', () => {
      const result = parseStudents('John', 'students.csv');
      expect(result.names).toEqual(['John']);
    });
  });
});
