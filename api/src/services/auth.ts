import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

// Matches the salt rounds used by db/seed.ts, so demo and registered
// accounts are hashed the same way.
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

export type AuthUser = { id: string; email: string; role: 'client' | 'photographer' };

export type TokenPayload = { sub: string; role: 'client' | 'photographer' };

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Throws if the token is missing, malformed, expired or signed with a
// different secret; callers map that to a 401.
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
}

// Always creates a 'client' — the only 'photographer' account comes from
// db/seed.ts, so self-registration can't mint a photographer.
export async function registerUser(email: string, password: string): Promise<AuthUser> {
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, role: 'client' })
    .returning({ id: users.id, email: users.email, role: users.role });
  if (!user) {
    throw new Error('Insert did not return the created user');
  }
  return user;
}

export async function findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | undefined> {
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email));
  return user;
}

export async function findUserById(id: string): Promise<AuthUser | undefined> {
  const [user] = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.id, id));
  return user;
}
