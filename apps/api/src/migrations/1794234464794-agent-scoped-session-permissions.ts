import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The live session and CSV extraction run routes now check their keys on the agent. Agent owners,
 * admins and members get the live keys, and `project_member` loses them, so a person invited to one
 * agent no longer reaches the other agents of the project. Project owners and admins keep every key
 * and reach each agent through inheritance. No schema change: role_permission rows only.
 */
const LIVE_PERMISSION_KEYS = [
  "csv_extraction_run.read",
  "csv_extraction_run.create",
  "csv_extraction_run.update",
  "csv_extraction_run.delete",
  "agent.conversation.session.read",
  "agent.conversation.session.create",
  "agent.conversation.session.delete",
  "agent.extraction.session.read",
  "agent.extraction.session.create",
  "agent.extraction.session.delete",
]

const AGENT_ROLE_KEYS = ["agent_owner", "agent_admin", "agent_member"]

export class AgentScopedSessionPermissions1794234464794 implements MigrationInterface {
  name = "AgentScopedSessionPermissions1794234464794"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN unnest($2::text[]) AS permission(key)
      WHERE role.key = ANY($1::text[])
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `,
      [AGENT_ROLE_KEYS, LIVE_PERMISSION_KEYS],
    )

    await queryRunner.query(
      `
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'project_member'
        AND role_permission.permission_key = ANY($1::text[])
    `,
      [LIVE_PERMISSION_KEYS],
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN unnest($1::text[]) AS permission(key)
      WHERE role.key = 'project_member'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `,
      [LIVE_PERMISSION_KEYS],
    )

    await queryRunner.query(
      `
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = ANY($1::text[])
        AND role_permission.permission_key = ANY($2::text[])
    `,
      [AGENT_ROLE_KEYS, LIVE_PERMISSION_KEYS],
    )
  }
}
