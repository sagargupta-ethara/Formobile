import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import type { Role } from "@prisma/client";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me"
);
const COOKIE = "bpf_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  specializationId: string | null;
  isSuperAdmin: boolean;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Mint a signed session JWT for a user (same token works as a cookie OR as an
 *  Authorization: Bearer header — used by web and the mobile app respectively). */
export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
}

/** Create a web session (sets the httpOnly cookie) and return the raw token so
 *  callers can also hand it back in the response body for mobile clients. */
export async function createSession(user: SessionUser): Promise<string> {
  const token = await signToken(user);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as Role,
      specializationId: (payload.specializationId as string | null) ?? null,
      isSuperAdmin: Boolean(payload.isSuperAdmin),
    };
  } catch {
    return null;
  }
}

/** Resolve the current session. Reads the httpOnly cookie first (web), then
 *  falls back to an `Authorization: Bearer <token>` header (mobile app). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookieToken = store.get(COOKIE)?.value;
  if (cookieToken) {
    const fromCookie = await verifyToken(cookieToken);
    if (fromCookie) return fromCookie;
  }

  const hdrs = await headers();
  const auth = hdrs.get("authorization") ?? hdrs.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return verifyToken(auth.slice(7).trim());
  }
  return null;
}

