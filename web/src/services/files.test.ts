import { describe, it, expect } from 'vitest';
import { formatBytes, describeCsvProblem, readFileAsText } from './files';

/** Fake File exposing only what readFileAsText touches. */
const fakeFile = (size: number, text: () => Promise<string>): File =>
  ({ size, text } as unknown as File);

const rejectWith = (name: string) => () =>
  Promise.reject(Object.assign(new Error('low-level failure'), { name }));

describe('readFileAsText', () => {
  it('returns the text of a readable file', async () => {
    await expect(readFileAsText(fakeFile(5, () => Promise.resolve('a,b\n')))).resolves.toBe('a,b\n');
  });
  it('rejects empty files up front', async () => {
    await expect(readFileAsText(fakeFile(0, () => Promise.resolve('')))).rejects.toThrow(/empty/);
  });
  it('maps NotReadableError to the cloud-storage hint', async () => {
    await expect(readFileAsText(fakeFile(5, rejectWith('NotReadableError')))).rejects.toThrow(
      /cloud storage/,
    );
  });
  it('maps NotFoundError to a moved/deleted message', async () => {
    await expect(readFileAsText(fakeFile(5, rejectWith('NotFoundError')))).rejects.toThrow(
      /no longer be found/,
    );
  });
  it('maps SecurityError to an access message', async () => {
    await expect(readFileAsText(fakeFile(5, rejectWith('SecurityError')))).rejects.toThrow(
      /blocked by the browser/,
    );
  });
  it('surfaces unknown errors with their name', async () => {
    await expect(readFileAsText(fakeFile(5, rejectWith('WeirdError')))).rejects.toThrow(
      /WeirdError: low-level failure/,
    );
  });
});

describe('formatBytes', () => {
  it('formats bytes, KB and MB', () => {
    expect(formatBytes(0)).toBe('0 bytes');
    expect(formatBytes(500)).toBe('500 bytes');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
  });
});

describe('describeCsvProblem', () => {
  it('accepts a normal CSV', () => {
    expect(describeCsvProblem('Date,Amount\n2026-01-01,50\n', 'x.csv')).toBeNull();
  });
  it('flags empty content', () => {
    expect(describeCsvProblem('   \n ', 'x.csv')).toMatch(/no text content/);
  });
  it('flags an xlsx/zip workbook by magic bytes', () => {
    expect(describeCsvProblem('PKbinary', 'export.csv')).toMatch(/Excel or Numbers/);
  });
  it('flags a workbook by extension even if it read as text', () => {
    expect(describeCsvProblem('anything', 'trades.xlsx')).toMatch(/Excel or Numbers/);
  });
  it('flags a PDF', () => {
    expect(describeCsvProblem('%PDF-1.7', 'report.pdf')).toMatch(/PDF/);
  });
  it('flags an old .xls', () => {
    expect(describeCsvProblem('plain', 'old.xls')).toMatch(/old Excel/);
  });
  it('flags binary content with NUL bytes', () => {
    const nul = String.fromCharCode(0);
    expect(describeCsvProblem(`Da${nul}te,Amount`, 'weird.csv')).toMatch(/binary/);
  });
});
