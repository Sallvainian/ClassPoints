import { describe, it, expect } from 'vitest';
import { parseJSON, parseCSV, parseStudents, generateDisplayNames } from '../studentParser';

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

    it('detects "LastName, FirstName" format and keeps whole line', () => {
      const result = parseCSV('Anaduaka, Chukwubueze\nBrown, John III\nBird, Brandon');
      expect(result.names).toEqual(['Anaduaka, Chukwubueze', 'Brown, John III', 'Bird, Brandon']);
    });

    it('handles complex "LastName, FirstName" names with multiple words', () => {
      const result = parseCSV('De La Cruz, Carolayn\nHechavarria Matos, Katheryn Alexa\nLagos Morales, Ansel Monserath');
      expect(result.names).toEqual([
        'De La Cruz, Carolayn',
        'Hechavarria Matos, Katheryn Alexa',
        'Lagos Morales, Ansel Monserath'
      ]);
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

  describe('generateDisplayNames', () => {
    it('extracts first name from "LastName FirstName" format', () => {
      const result = generateDisplayNames(['Smith John', 'Doe Jane']);
      expect(result).toEqual(['John', 'Jane']);
    });

    it('extracts first name from comma-separated format', () => {
      const result = generateDisplayNames(['Smith, John', 'Doe, Jane']);
      expect(result).toEqual(['John', 'Jane']);
    });

    it('handles single names', () => {
      const result = generateDisplayNames(['John', 'Jane']);
      expect(result).toEqual(['John', 'Jane']);
    });

    it('adds last initial for duplicate first names', () => {
      const result = generateDisplayNames(['Smith John', 'Doe John', 'Wilson Jane']);
      expect(result).toEqual(['John S.', 'John D.', 'Jane']);
    });

    it('uses full last name when initials also collide', () => {
      const result = generateDisplayNames(['Smith John', 'Stevens John', 'Doe Jane']);
      expect(result).toEqual(['John Smith', 'John Stevens', 'Jane']);
    });

    it('handles mixed collision scenarios', () => {
      // Two Johns with same initial, one John with different initial
      const result = generateDisplayNames([
        'Smith John',
        'Stevens John',
        'Davis John',
        'Wilson Jane'
      ]);
      expect(result).toEqual(['John Smith', 'John Stevens', 'John D.', 'Jane']);
    });

    it('is case insensitive for first name matching', () => {
      const result = generateDisplayNames(['Smith JOHN', 'Doe john']);
      expect(result).toEqual(['JOHN S.', 'john D.']);
    });

    it('extracts only first name, dropping middle names', () => {
      const result = generateDisplayNames(['Smith Mary Jane', 'Doe Bob']);
      expect(result).toEqual(['Mary', 'Bob']);
    });

    it('preserves suffixes like Jr, III', () => {
      const result = generateDisplayNames(['Brown John III', 'Rodgers Brent Jr']);
      expect(result).toEqual(['John III', 'Brent Jr']);
    });

    it('handles empty last names gracefully', () => {
      const result = generateDisplayNames(['John', 'Smith John']);
      expect(result).toEqual(['John', 'John S.']);
    });

    it('handles full classroom roster in "LastName, FirstName" format', () => {
      const roster = [
        'Anaduaka, Chukwubueze',
        'Brown, John III',
        'Bird, Brandon',
        'De La Cruz, Carolayn',
        'Garcia, Keyle',
        'Hechavarria Matos, Katheryn Alexa',
        'Howard, Morgan Amirah',
        'Lagos Morales, Ansel Monserath',
        'Lampley, Taraji',
        'Ortiz, Isabella',
        'Pineda Samaniego, Hally Maya',
        'Reyes Martinez, Bexaida Maidely',
        'Rincon Acta, Jade Sarai',
        'Rodgers, Brent Te\'nir Jr',
        'Thalerand, Anne Marly',
        'Velasquez, Josue',
        'Yuvi Sanchez, Vicky Belen'
      ];
      const result = generateDisplayNames(roster);
      // Only first names (middle names dropped, suffixes kept)
      expect(result).toEqual([
        'Chukwubueze',
        'John III',
        'Brandon',
        'Carolayn',
        'Keyle',
        'Katheryn',      // Alexa (middle) dropped
        'Morgan',        // Amirah (middle) dropped
        'Ansel',         // Monserath (middle) dropped
        'Taraji',
        'Isabella',
        'Hally',         // Maya (middle) dropped
        'Bexaida',       // Maidely (middle) dropped
        'Jade',          // Sarai (middle) dropped
        'Brent Jr',      // Te'nir (middle) dropped, Jr suffix kept
        'Anne',          // Marly (middle) dropped
        'Josue',
        'Vicky'          // Belen (middle) dropped
      ]);
    });
  });
});
