/**
 * Parse student names from JSON or CSV content
 */

export interface ParseResult {
  names: string[];
  errors: string[];
}

interface ParsedName {
  firstName: string;
  lastName: string;
  original: string;
}

// Common name suffixes to preserve (case-insensitive)
const NAME_SUFFIXES = new Set([
  'jr', 'jr.', 'sr', 'sr.', 'i', 'ii', 'iii', 'iv', 'v', 'vi',
  'esq', 'esq.', 'phd', 'md', 'dds', 'dvm'
]);

/**
 * Extract just the first name (and any suffix) from a full first name string
 * "Katheryn Alexa" → "Katheryn"
 * "John III" → "John III"
 * "Brent Te'nir Jr" → "Brent Jr" (or just "Brent" if we can't detect the pattern)
 */
function extractFirstNameOnly(fullFirstName: string): string {
  const parts = fullFirstName.trim().split(/\s+/);
  if (parts.length <= 1) return fullFirstName.trim();

  // First word is always the first name
  const firstName = parts[0];

  // Collect any suffixes from the remaining parts
  const suffixes: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    if (NAME_SUFFIXES.has(parts[i].toLowerCase())) {
      suffixes.push(parts[i]);
    }
  }

  if (suffixes.length > 0) {
    return `${firstName} ${suffixes.join(' ')}`;
  }

  return firstName;
}

/**
 * Parse a full name into first and last name components
 * Handles formats:
 * - "LastName FirstName" (space separated, last name first)
 * - "LastName, FirstName" (comma separated)
 * - "FirstName" (single name)
 *
 * Only extracts the actual first name (drops middle names, keeps suffixes)
 */
function parseFullName(fullName: string): ParsedName {
  const trimmed = fullName.trim();

  // Check for comma-separated format: "LastName, FirstName MiddleName"
  if (trimmed.includes(',')) {
    const [lastName, ...rest] = trimmed.split(',');
    const fullFirstPart = rest.join(',').trim();
    const firstName = extractFirstNameOnly(fullFirstPart);
    return {
      firstName: firstName || lastName.trim(),
      lastName: firstName ? lastName.trim() : '',
      original: trimmed
    };
  }

  // Space-separated format: assume "LastName FirstName MiddleName" (last name first)
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', original: trimmed };
  }

  // Last name is first, rest is first name + middle names
  const lastName = parts[0];
  const fullFirstPart = parts.slice(1).join(' ');
  const firstName = extractFirstNameOnly(fullFirstPart);

  return { firstName, lastName, original: trimmed };
}

/**
 * Generate display names from parsed names with disambiguation for duplicates
 * - Uses first name as base
 * - Adds last initial if first names collide
 * - Adds full last name if initials also collide
 */
export function generateDisplayNames(rawNames: string[]): string[] {
  const parsedNames = rawNames.map(parseFullName);

  // Group by first name to detect duplicates
  const firstNameGroups = new Map<string, ParsedName[]>();
  for (const parsed of parsedNames) {
    const key = parsed.firstName.toLowerCase();
    const group = firstNameGroups.get(key) || [];
    group.push(parsed);
    firstNameGroups.set(key, group);
  }

  // Generate display names
  return parsedNames.map(parsed => {
    const key = parsed.firstName.toLowerCase();
    const group = firstNameGroups.get(key)!;

    // No duplicates - just use first name
    if (group.length === 1) {
      return parsed.firstName;
    }

    // Has duplicates - need to disambiguate
    if (!parsed.lastName) {
      return parsed.firstName;
    }

    const lastInitial = parsed.lastName[0].toUpperCase();

    // Check if last initial is enough to disambiguate
    const sameInitial = group.filter(p =>
      p.lastName && p.lastName[0].toUpperCase() === lastInitial
    );

    if (sameInitial.length === 1) {
      // Last initial is unique within the group
      return `${parsed.firstName} ${lastInitial}.`;
    }

    // Multiple people with same first name AND same last initial - use full last name
    return `${parsed.firstName} ${parsed.lastName}`;
  });
}

/**
 * Parse JSON content - expects array of objects with 'name' property
 * or simple array of strings
 *
 * Supported formats:
 * - ["John", "Jane"]
 * - [{"name": "John"}, {"name": "Jane"}]
 * - [{"Name": "John"}, {"student": "Jane"}] (flexible key matching)
 */
export function parseJSON(content: string): ParseResult {
  const errors: string[] = [];
  const names: string[] = [];

  try {
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      return { names: [], errors: ['JSON must be an array'] };
    }

    data.forEach((item, index) => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) {
          names.push(trimmed);
        }
      } else if (typeof item === 'object' && item !== null) {
        // Try common property names for student name
        const nameKeys = ['name', 'Name', 'student', 'Student', 'studentName', 'StudentName', 'fullName', 'FullName'];
        let found = false;

        for (const key of nameKeys) {
          if (key in item && typeof item[key] === 'string') {
            const trimmed = item[key].trim();
            if (trimmed) {
              names.push(trimmed);
              found = true;
              break;
            }
          }
        }

        // If no standard key found, try first string property
        if (!found) {
          for (const value of Object.values(item)) {
            if (typeof value === 'string' && value.trim()) {
              names.push(value.trim());
              found = true;
              break;
            }
          }
        }

        if (!found) {
          errors.push(`Row ${index + 1}: Could not find name property`);
        }
      } else {
        errors.push(`Row ${index + 1}: Invalid item type`);
      }
    });
  } catch {
    return { names: [], errors: ['Invalid JSON format'] };
  }

  return { names, errors };
}

/**
 * Parse CSV content - expects names in first column or single column
 * Handles optional header row
 *
 * Supported formats:
 * - One name per line
 * - "LastName, FirstName" format (one per line)
 * - CSV with header: name,other,columns
 * - CSV without header: John,Smith,... (takes first column)
 */
export function parseCSV(content: string): ParseResult {
  const errors: string[] = [];
  const names: string[] = [];

  const lines = content.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    return { names: [], errors: ['CSV file is empty'] };
  }

  // Check if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('name') ||
                    firstLine.includes('student') ||
                    firstLine === 'names' ||
                    firstLine === 'students';

  const startIndex = hasHeader ? 1 : 0;

  // Detect if this is a "LastName, FirstName" format (not a true CSV)
  // Pattern: most lines have exactly one comma followed by a space
  const isLastFirstFormat = !hasHeader && detectLastFirstFormat(lines);

  // Find the name column index from header
  let nameColumnIndex = 0;
  if (hasHeader) {
    const headers = parseCSVLine(lines[0]);
    const headerLower = headers.map(h => h.toLowerCase().trim());

    const nameIndex = headerLower.findIndex(h =>
      h === 'name' || h === 'student' || h === 'studentname' || h === 'fullname' || h === 'names'
    );

    if (nameIndex !== -1) {
      nameColumnIndex = nameIndex;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // If it's "LastName, FirstName" format, use the whole line as the name
    if (isLastFirstFormat) {
      names.push(line);
      continue;
    }

    const columns = parseCSVLine(line);

    if (columns.length > nameColumnIndex) {
      const name = columns[nameColumnIndex].trim();
      if (name) {
        names.push(name);
      }
    } else if (columns.length > 0 && columns[0].trim()) {
      // Fallback to first column
      names.push(columns[0].trim());
    } else {
      errors.push(`Line ${i + 1}: Empty name`);
    }
  }

  return { names, errors };
}

/**
 * Detect if content is in "LastName, FirstName" format
 * (one name per line with comma as name separator, not column separator)
 */
function detectLastFirstFormat(lines: string[]): boolean {
  if (lines.length === 0) return false;

  let matchCount = 0;
  const sampleSize = Math.min(lines.length, 10);

  for (let i = 0; i < sampleSize; i++) {
    const line = lines[i].trim();
    // Pattern: "Word(s), Word(s)" - exactly one comma followed by space, text on both sides
    const match = line.match(/^[^,]+,\s+[^,]+$/);
    if (match) {
      matchCount++;
    }
  }

  // If most lines match the pattern, it's likely "LastName, FirstName" format
  return matchCount >= sampleSize * 0.7;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Auto-detect format and parse
 */
export function parseStudents(content: string, filename?: string): ParseResult {
  const trimmed = content.trim();

  // Try to detect format
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'json') {
      return parseJSON(trimmed);
    }
    if (ext === 'csv') {
      return parseCSV(trimmed);
    }
  }

  // Auto-detect based on content
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJSON(trimmed);
  }

  return parseCSV(trimmed);
}
