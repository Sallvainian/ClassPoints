/**
 * Parse student names from JSON or CSV content
 */

export interface ParseResult {
  names: string[];
  errors: string[];
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
  } catch (e) {
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
