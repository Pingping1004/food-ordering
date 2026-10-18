import {
  generateInviteCode,
  normaliseInviteCode,
  formatInviteCode,
  isValidInviteCodeShape,
  INVITE_CODE_ALPHABET,
} from './invite-code';

describe('invite-code', () => {
  it('generates 8 chars from the safe alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
      for (const ch of code) expect(INVITE_CODE_ALPHABET).toContain(ch);
    }
  });

  it('alphabet has no ambiguous characters', () => {
    for (const ch of 'IO01') expect(INVITE_CODE_ALPHABET).not.toContain(ch);
  });

  it('produces different codes', () => {
    const set = new Set(Array.from({ length: 50 }, generateInviteCode));
    expect(set.size).toBeGreaterThan(45);
  });

  it('normalises case, dashes and spaces', () => {
    expect(normaliseInviteCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normaliseInviteCode('ab cd - ef gh')).toBe('ABCDEFGH');
  });

  it('formats as XXXX-XXXX and is idempotent via normalise', () => {
    expect(formatInviteCode('abcdefgh')).toBe('ABCD-EFGH');
    expect(normaliseInviteCode(formatInviteCode('ABCDEFGH'))).toBe('ABCDEFGH');
  });

  it('validates shape', () => {
    expect(isValidInviteCodeShape('abcd-efgh')).toBe(true);
    expect(isValidInviteCodeShape('ABCD-EFG')).toBe(false);
    expect(isValidInviteCodeShape('ABCD-EFG0')).toBe(false);
    expect(isValidInviteCodeShape('')).toBe(false);
  });
});
