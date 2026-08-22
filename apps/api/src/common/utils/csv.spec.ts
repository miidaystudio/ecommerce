import { csvRowsToRecords, parseCsv } from './csv';

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
