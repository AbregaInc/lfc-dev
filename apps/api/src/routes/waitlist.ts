import { Hono } from "hono";
import type { AppEnv } from "../env.js";

const waitlist = new Hono<AppEnv>();

const VALID_PLANS = new Set(["team", "enterprise"]);
const MAX_LENGTHS = {
  email: 254,
  name: 120,
  company: 160,
  message: 1000,
  source: 80,
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`Must be ${maxLength} characters or less`);
  }
  return normalized.length > 0 ? normalized : null;
}

waitlist.post("/", async (c) => {
  const db = c.env.DB;
  const parsed = await c.req.json().catch(() => ({}));
  const body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

  if (typeof body.website === "string" && body.website.trim()) {
    return c.json({ ok: true });
  }

  const email = normalizeEmail(body.email);
  const plan = typeof body.plan === "string" ? body.plan.trim().toLowerCase() : "";

  if (!email || email.length > MAX_LENGTHS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "A valid email is required" }, 400);
  }

  if (!VALID_PLANS.has(plan)) {
    return c.json({ error: "Choose a valid waitlist plan" }, 400);
  }

  let signup;
  try {
    signup = {
      id: crypto.randomUUID(),
      email,
      name: normalizeText(body.name, MAX_LENGTHS.name),
      company: normalizeText(body.company, MAX_LENGTHS.company),
      plan,
      message: normalizeText(body.message, MAX_LENGTHS.message),
      source: normalizeText(body.source, MAX_LENGTHS.source) || "pricing",
    };
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid waitlist submission" }, 400);
  }

  await db
    .prepare(
      `INSERT INTO waitlist_signups (id, email, name, company, plan, message, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email, plan) DO UPDATE SET
         name = excluded.name,
         company = excluded.company,
         message = excluded.message,
         source = excluded.source,
         updated_at = datetime('now')`
    )
    .bind(signup.id, signup.email, signup.name, signup.company, signup.plan, signup.message, signup.source)
    .run();

  return c.json({ ok: true, waitlist: { email: signup.email, plan: signup.plan } });
});

export default waitlist;
