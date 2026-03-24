import { describe, it, expect } from 'vitest';
import { generateInviteToken } from '@/lib/invite';

describe('generateInviteToken', () => {
  it('returns a 12-character string', () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(12);
  });

  it('returns only alphanumeric characters', () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[a-z0-9]+$/);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateInviteToken()));
    expect(tokens.size).toBe(20);
  });
});
