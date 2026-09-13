import { csvRowsToRecords, parseCsv, toCsv, toCsvValue } from './csv';

describe('parseCsv', () => {
  it('parses a simple comma-separated file', () => {
    const rows = parseCsv('name,price\nOat Runner,1490\nCharcoal Runner,1290\n');
    expect(rows).toEqual([
      ['name', 'price'],
      ['Oat Runner', '1490'],
      ['Charcoal Runner', '1290'],
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('name,description\n"Runner, Oat","A slow, textured runner"\n');
    expect(rows).toEqual([
      ['name', 'description'],
      ['Runner, Oat', 'A slow, textured runner'],
    ]);
  });

  it('handles escaped double quotes inside quoted fields', () => {
    const rows = parseCsv('name\n"A ""slow"" runner"\n');
    expect(rows).toEqual([['name'], ['A "slow" runner']]);
  });

  it('skips blank lines', () => {
    const rows = parseCsv('name,price\n\nOat,100\n\n');
    expect(rows).toEqual([
      ['name', 'price'],
      ['Oat', '100'],
    ]);
  });
});

describe('csvRowsToRecords', () => {
  it('maps rows to header-keyed records', () => {
    const records = csvRowsToRecords([
      ['name', 'price'],
      ['Oat Runner', '1490'],
    ]);
    expect(records).toEqual([{ name: 'Oat Runner', price: '1490' }]);
  });

  it('returns an empty array when there are no rows', () => {
    expect(csvRowsToRecords([])).toEqual([]);
  });
});

describe('toCsvValue', () => {
  it('leaves an ordinary value untouched', () => {
    expect(toCsvValue('Linen Runner')).toBe('Linen Runner');
    expect(toCsvValue(1490)).toBe('1490');
  });

  it('renders null and undefined as an empty cell, not the word "null"', () => {
    expect(toCsvValue(null)).toBe('');
    expect(toCsvValue(undefined)).toBe('');
  });

  it('quotes a value containing a comma', () => {
    expect(toCsvValue('Runner, charcoal')).toBe('"Runner, charcoal"');
  });

  it('doubles embedded quotes and wraps the value', () => {
    expect(toCsvValue('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes a value containing a newline', () => {
    expect(toCsvValue('line one\nline two')).toBe('"line one\nline two"');
  });

  // A spreadsheet treats a cell starting with = + - @ as a formula. Product
  // names and coupon descriptions are user-supplied, so an export could
  // otherwise run whatever an attacker typed, on the admin's own machine.
  it.each(['=1+1', '+1', '-1', '@SUM(A1)'])('defuses the formula-injection payload %p', (payload) => {
    expect(toCsvValue(payload).startsWith("'")).toBe(true);
  });

  // When the payload also contains a quote or comma the cell gets wrapped, so
  // the defusing prefix sits just inside the opening quote rather than at the
  // very start of the cell. Both protections have to apply, not one or other.
  it.each(['=HYPERLINK("http://evil.example.com")', '=cmd,"x"', '@SUM(A1,B1)'])(
    'defuses %p while still quoting it correctly',
    (payload) => {
      const result = toCsvValue(payload);
      expect(result.startsWith('"\'')).toBe(true);
      expect(result.endsWith('"')).toBe(true);
    },
  );

  it('prefixes a negative number too — the raw value stays readable', () => {
    expect(toCsvValue(-5)).toBe("'-5");
  });

  it('serializes a Date as ISO', () => {
    expect(toCsvValue(new Date('2026-03-02T10:00:00.000Z'))).toBe('2026-03-02T10:00:00.000Z');
  });
});

describe('toCsv', () => {
  it('writes a header row followed by data rows, CRLF terminated for Excel', () => {
    const csv = toCsv(
      ['Period', 'Orders'],
      [
        ['2026-03-02', 2],
        ['2026-03-05', 1],
      ],
    );
    expect(csv).toBe('Period,Orders\r\n2026-03-02,2\r\n2026-03-05,1\r\n');
  });

  it('writes just the header when there are no rows', () => {
    expect(toCsv(['Period', 'Orders'], [])).toBe('Period,Orders\r\n');
  });

  it('round-trips through parseCsv', () => {
    const csv = toCsv(['name', 'note'], [['Runner, charcoal', 'He said "hi"']]);
    const records = csvRowsToRecords(parseCsv(csv));
    expect(records[0]).toEqual({ name: 'Runner, charcoal', note: 'He said "hi"' });
  });
});
