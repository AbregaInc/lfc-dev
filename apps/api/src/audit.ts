export async function logAudit(
  db: D1Database,
  orgId: string,
  userId: string | null,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  details?: Record<string, unknown> | null
) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO audit_log (id, orgId, userId, action, resourceType, resourceId, details) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, orgId, userId, action, resourceType, resourceId, details ? JSON.stringify(details) : null)
    .run();
}
