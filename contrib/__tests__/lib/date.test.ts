import { describe, it, expect } from 'vitest';
import { formatDueDate } from '@/lib/date';

describe('formatDueDate', () => {
  it('formats a date in the current year without year suffix', () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-06-15`;
    const result = formatDueDate(dateStr);
    expect(result).toBe('Jun 15');
  });

  it('formats a date in a different year with year suffix', () => {
    const result = formatDueDate('2099-12-25');
    expect(result).toBe('Dec 25, 2099');
  });

  it('handles single-digit day', () => {
    const result = formatDueDate('2099-01-05');
    expect(result).toBe('Jan 5, 2099');
  });

  it('does not crash on empty string', () => {
    expect(() => formatDueDate('')).not.toThrow();
  });
});
