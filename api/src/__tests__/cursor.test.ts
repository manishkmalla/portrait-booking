import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '../lib/cursor.js';

describe('cursor', () => {
  it('round-trips through encode/decode', () => {
    const sortValue = new Date('2026-01-15T10:00:00.000Z');
    const id = 'a1b2c3';

    const cursor = encodeCursor(sortValue, id);
    const decoded = decodeCursor(cursor);

    expect(decoded).toEqual({ sortValue, id });
  });

  it('returns null for garbage input', () => {
    expect(decodeCursor('not-base64url-!!!')).toBeNull();
  });

  it('returns null when the id half is missing', () => {
    const noId = Buffer.from('2026-01-15T10:00:00.000Z|').toString('base64url');
    expect(decodeCursor(noId)).toBeNull();
  });

  it('returns null for an invalid date', () => {
    const badDate = Buffer.from('not-a-date|a1b2c3').toString('base64url');
    expect(decodeCursor(badDate)).toBeNull();
  });
});
