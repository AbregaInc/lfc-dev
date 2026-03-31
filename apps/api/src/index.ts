import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env.js";
import authRoutes from "./routes/auth.js";
import orgRoutes from "./routes/orgs.js";
import profileRoutes from "./routes/profiles.js";
import profileArtifactRoutes from "./routes/profile-artifacts.js";
import artifactRoutes from "./routes/artifacts.js";
import submissionRoutes from "./routes/submissions.js";
import secretRoutes from "./routes/secrets.js";
import inviteRoutes from "./routes/invites.js";
import userRoutes from "./routes/users.js";
import auditRoutes from "./routes/audit.js";
import statusRoutes from "./routes/status.js";
import deviceRoutes from "./routes/devices.js";
import setupRoutes from "./routes/setup.js";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const envOrigins = c.env.CORS_ORIGINS?.split(",").map((value) => value.trim()) || [];
  const origins = [
    ...envOrigins,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4173",
    "http://localhost:4174",
    "http://localhost:1420",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:4174",
    "http://127.0.0.1:1420",
    "tauri://localhost",
  ];

  const middleware = cors({
    origin: origins,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  return middleware(c, next);
});

app.get("/api/health", (c) => c.json({ status: "ok", service: "lfc-api", mode: "artifact-sync-v2" }));

app.route("/api/auth", authRoutes);
app.route("/api/orgs", orgRoutes);
app.route("/api/orgs/:orgId/profiles", profileRoutes);
app.route("/api/orgs/:orgId/profiles/:profileId/artifacts", profileArtifactRoutes);
app.route("/api/orgs/:orgId/artifacts", artifactRoutes);
app.route("/api/orgs/:orgId/submissions", submissionRoutes);
app.route("/api/orgs/:orgId/secrets", secretRoutes);
app.route("/api/orgs/:orgId/users", userRoutes);
app.route("/api/orgs", inviteRoutes);
app.route("/api", inviteRoutes);
app.route("/api/orgs/:orgId/audit", auditRoutes);
app.route("/api/orgs/:orgId/status", statusRoutes);
app.route("/api", deviceRoutes);
app.route("/api/admin", setupRoutes);

export default app;
