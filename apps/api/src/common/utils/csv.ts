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
