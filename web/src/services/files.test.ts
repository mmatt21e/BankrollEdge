import { describe, it, expect } from 'vitest';
import { formatBytes, describeCsvProblem } from './files';

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
