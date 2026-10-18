import { randomInt } from 'crypto';

/** No I, O, 0, 1 – avoids look-alikes when a code is read aloud or typed from a poster. */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/** Random code, stored/compared in its normalised form (8 chars, no dash). */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/** User input -> storage form: uppercase, with dashes and whitespace removed. */
export function normaliseInviteCode(input: string): string {
  return (input ?? '').toUpperCase().replace(/[\s-]/g, '');
}

/** Storage form -> display form `XXXX-XXXX`. */
export function formatInviteCode(code: string): string {
  const c = normaliseInviteCode(code);
  return c.length === INVITE_CODE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Cheap shape check to reject garbage before hitting the database. */
export function isValidInviteCodeShape(input: string): boolean {
  const c = normaliseInviteCode(input);
  return (
    c.length === INVITE_CODE_LENGTH &&
    [...c].every((ch) => INVITE_CODE_ALPHABET.includes(ch))
  );
}
