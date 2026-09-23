import { z } from 'zod';

// Keyset pagination cursor: encodes the (sortValue, id) of the last row on a
// page so the next page can resume with `(sortValue, id) > (cursor...)`.
// sortValue is always a Date under the hood (starts_at for slots, the slot's
// starts_at for a user's bookings too).

// Shared query shape for every cursor-paginated list endpoint.
export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function encodeCursor(sortValue: Date, id: string): string {
  return Buffer.from(`${sortValue.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { sortValue: Date; id: string } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf('|');
  if (separatorIndex === -1) {
    return null;
  }

  const isoValue = decoded.slice(0, separatorIndex);
  const id = decoded.slice(separatorIndex + 1);
  if (!id) {
    return null;
  }

  const sortValue = new Date(isoValue);
  if (Number.isNaN(sortValue.getTime())) {
    return null;
  }

  return { sortValue, id };
}
