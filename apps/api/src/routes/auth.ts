import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { AppEnv } from "../env.js";
import { signToken, authMiddleware, getUser } from "../auth.js";

const auth = new Hono<AppEnv>();

auth.post("/register", async (c) => {
  const db = c.env.DB;
  const { email, password, name } = await c.req.json();

  if (!email || !password || !name) {
    return c.json({ error: "email, password, and name are required" }, 400);
  }

  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const domain = email.split("@")[1]?.toLowerCase();
  let existingOrgs: { orgId: string; orgName: string; memberCount: number }[] = [];

  const FREE_EMAIL_PROVIDERS = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.jp",
    "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.de", "live.com", "live.co.uk",
    "msn.com", "icloud.com", "me.com", "mac.com",
    "protonmail.com", "protonmail.ch", "proton.me", "tutanota.com", "tutanota.de", "tuta.io",
    "aol.com", "zoho.com", "yandex.com", "yandex.ru", "mail.com", "mail.ru",
    "gmx.com", "gmx.de", "gmx.net", "web.de", "fastmail.com", "hey.com",
    "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "cox.net",
    "charter.net", "earthlink.net", "optonline.net",
    "qq.com", "163.com", "126.com", "sina.com", "naver.com", "daum.net",
    "rediffmail.com", "libero.it", "virgilio.it", "laposte.net", "orange.fr",
  ]);

  if (domain && !FREE_EMAIL_PROVIDERS.has(domain)) {
    const result = await db
      .prepare(
        `SELECT o.id as orgId, o.name as orgName, COUNT(u.id) as memberCount
         FROM users u JOIN orgs o ON u.org_id = o.id
         WHERE u.email LIKE ?
         GROUP BY o.id
         ORDER BY memberCount DESC
         LIMIT 5`
      )
      .bind(`%@${domain}`)
      .all<{ orgId: string; orgName: string; memberCount: number }>();

    existingOrgs = result.results;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .prepare("INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)")
    .bind(userId, email, passwordHash, name, "member")
    .run();

  const token = await signToken({ userId, email, orgId: null, role: "member" }, c.env.JWT_SECRET);

  return c.json({
    token,
    user: { id: userId, email, name, orgId: null, role: "member" },
    existingOrgs: existingOrgs.length > 0 ? existingOrgs : undefined,
  });
});

auth.post("/login", async (c) => {
  const db = c.env.DB;
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await db
    .prepare("SELECT id, email, password_hash, name, org_id as orgId, role FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; email: string; password_hash: string; name: string; orgId: string | null; role: string }>();

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signToken(
    { userId: user.id, email: user.email, orgId: user.orgId, role: user.role },
    c.env.JWT_SECRET
  );

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, orgId: user.orgId, role: user.role },
  });
});

auth.get("/me", authMiddleware, (c) => {
  const user = getUser(c);
  return c.json({ user });
});

export default auth;
