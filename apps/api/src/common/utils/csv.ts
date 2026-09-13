// Minimal CSV parser (RFC 4180 subset): handles quoted fields, escaped ""
// quotes, and commas/newlines inside quotes. No external dependency needed
// for the row shapes this project's bulk-import feature accepts.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

export function csvRowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  const keys = header.map((h) => h.trim());
  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    keys.forEach((key, index) => {
      record[key] = (row[index] ?? '').trim();
    });
    return record;
  });
}

/**
 * Serializes rows for a report download.
 *
 * A leading =, +, - or @ is prefixed with a single quote: spreadsheet apps
 * treat such a cell as a formula, so an admin opening an export of
 * customer-supplied text (a product name, a coupon description) could otherwise
 * be running whatever that text says. Quoting defuses it while leaving the
 * value readable.
 */
export function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const raw = value instanceof Date ? value.toISOString() : String(value);
  const defused = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

  return /[",\n\r]/.test(defused) ? `"${defused.replace(/"/g, '""')}"` : defused;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(toCsvValue).join(',')];
  for (const row of rows) {
    lines.push(row.map(toCsvValue).join(','));
  }
  // CRLF: Excel is the overwhelmingly common consumer of these exports.
  return `${lines.join('\r\n')}\r\n`;
}
