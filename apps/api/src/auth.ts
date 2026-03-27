import { Context, Next } from "hono";
import { sign, verify } from "hono/jwt";
import type { AppEnv, AuthUser } from "./env.js";

export type { AuthUser };

export interface JwtPayload {
  userId: string;
  email: string;
  orgId: string | null;
  role: string;
  exp: number;
}

function resolveJwtSecret(secret: string | undefined): string {
  return secret || "lfc-local-dev-secret";
}

export async function signToken(payload: Omit<JwtPayload, "exp">, secret: string): Promise<string> {
  return sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 },
    resolveJwtSecret(secret)
  );
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  return (await verify(token, resolveJwtSecret(secret), "HS256")) as unknown as JwtPayload;
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await verifyToken(header.slice(7), c.env.JWT_SECRET);
    const user = await c.env.DB.prepare(
      "SELECT id, email, name, org_id as orgId, role FROM users WHERE id = ?"
    )
      .bind(payload.userId)
      .first<AuthUser>();

    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }

    c.set("user", user);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

export function getUser(c: Context<AppEnv>): AuthUser {
  return c.get("user") as AuthUser;
}
