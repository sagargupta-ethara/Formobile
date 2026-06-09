import "server-only";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getSession, type SessionUser } from "./auth";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

/** Throws 401 if not logged in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Not authenticated");
  return user;
}

/** Throws 401/403 unless the user has one of the allowed roles. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
  return user;
}
