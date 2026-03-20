import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { logAudit } from "../audit.js";

const sync = new Hono<AppEnv>();

sync.use("*", authMiddleware);

sync.post("/", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const { installedTools, currentVersions } = await c.req.json();

  if (!user.orgId) {
    return c.json({ error: "User is not part of an organization" }, 400);
  }

  // Get all profiles assigned to this user
  const profiles = (
    await db
      .prepare(
        `SELECT p.id, p.name, p.tools
         FROM profiles p
         JOIN user_profiles up ON p.id = up.profile_id
         WHERE up.user_id = ?`
      )
      .bind(user.id)
      .all<{ id: string; name: string; tools: string }>()
  ).results;

  const configs: {
    profileId: string;
    profileName: string;
    configType: string;
    content: string;
    version: number;
    targetTools: string[];
  }[] = [];

  for (const profile of profiles) {
    const profileTools = JSON.parse(profile.tools) as string[];
    const targetTools = installedTools
      ? profileTools.filter((t: string) => installedTools.includes(t))
      : profileTools;

    if (targetTools.length === 0) continue;

    const profileConfigs = (
      await db
        .prepare("SELECT id, config_type as configType, content, version FROM profile_configs WHERE profile_id = ?")
        .bind(profile.id)
        .all<{ id: string; configType: string; content: string; version: number }>()
    ).results;

    for (const config of profileConfigs) {
      const versionKey = `${profile.id}:${config.configType}`;
      if (currentVersions && currentVersions[versionKey] === config.version) {
        continue;
      }

      configs.push({
        profileId: profile.id,
        profileName: profile.name,
        configType: config.configType,
        content: config.content,
        version: config.version,
        targetTools,
      });
    }
  }

  // Resolve secrets
  const orgSecrets = (
    await db
      .prepare("SELECT name, value_encrypted as value FROM secrets WHERE org_id = ?")
      .bind(user.orgId)
      .all<{ name: string; value: string }>()
  ).results;

  const secretMap: Record<string, string> = {};
  for (const secret of orgSecrets) {
    secretMap[secret.name] = secret.value;
  }

  const resolvedConfigs = configs.map((config) => {
    let content = config.content;
    for (const [name, value] of Object.entries(secretMap)) {
      content = content.replaceAll(`{{${name}}}`, value);
    }
    return { ...config, content };
  });

  // Record sync event
  const configVersionMap: Record<string, number> = {};
  for (const config of configs) {
    configVersionMap[`${config.profileId}:${config.configType}`] = config.version;
  }
  if (currentVersions) {
    for (const [key, version] of Object.entries(currentVersions)) {
      if (!(key in configVersionMap)) {
        configVersionMap[key] = version as number;
      }
    }
  }

  const syncEventId = crypto.randomUUID();
  await db
    .prepare("INSERT INTO sync_events (id, orgId, userId, installedTools, configVersions) VALUES (?, ?, ?, ?, ?)")
    .bind(
      syncEventId,
      user.orgId,
      user.id,
      installedTools ? JSON.stringify(installedTools) : null,
      JSON.stringify(configVersionMap)
    )
    .run();

  await logAudit(db, user.orgId, user.id, "sync.completed", "user", user.id, {
    configCount: resolvedConfigs.length,
    installedTools,
  });

  return c.json({ configs: resolvedConfigs, secrets: secretMap });
});

export default sync;
