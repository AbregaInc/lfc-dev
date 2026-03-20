import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env.js";
import authRoutes from "./routes/auth.js";
import orgRoutes from "./routes/orgs.js";
import profileRoutes from "./routes/profiles.js";
import configRoutes from "./routes/configs.js";
import secretRoutes from "./routes/secrets.js";
import inviteRoutes from "./routes/invites.js";
import syncRoutes from "./routes/sync.js";
import userRoutes from "./routes/users.js";
import suggestionsRoutes from "./routes/suggestions.js";
import auditRoutes from "./routes/audit.js";
import statusRoutes from "./routes/status.js";
import snapshotRoutes from "./routes/snapshots.js";
import setupRoutes from "./routes/setup.js";

const app = new Hono<AppEnv>();

// CORS — origins from env, plus always allow tray app
app.use("*", async (c, next) => {
  const envOrigins = c.env.CORS_ORIGINS?.split(",").map((s) => s.trim()) || [];
  const origins = [
    ...envOrigins,
    "http://localhost:5173",
    "http://localhost:1420",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:1420",
    "tauri://localhost",
  ];

  const corsMiddleware = cors({
    origin: origins,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  return corsMiddleware(c, next);
});

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", service: "lfc-api" }));

// Mount routes
app.route("/api/auth", authRoutes);
app.route("/api/orgs", orgRoutes);
app.route("/api/orgs/:orgId/profiles/:profileId/configs", configRoutes);
app.route("/api/orgs/:orgId/profiles", profileRoutes);
app.route("/api/orgs/:orgId/secrets", secretRoutes);
app.route("/api/orgs/:orgId/users", userRoutes);
app.route("/api/orgs", inviteRoutes);
app.route("/api", inviteRoutes);
app.route("/api/sync", syncRoutes);
app.route("/api/orgs/:orgId/suggestions", suggestionsRoutes);
app.route("/api/orgs/:orgId/audit", auditRoutes);
app.route("/api/orgs/:orgId/status", statusRoutes);
app.route("/api/snapshots", snapshotRoutes);
app.route("/api/orgs/:orgId/inventory", snapshotRoutes);
app.route("/api/admin", setupRoutes);

export default app;
