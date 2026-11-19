import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The tester message and stream routes check the tester's own keys on the session's campaign, so
 * no route reads the live session keys a tester held on the campaign's project. The
 * `review_campaign_tester` role loses them. No schema change: role_permission rows only.
 */
const LIVE_SESSION_PERMISSION_KEYS = [
  "agent.conversation.session.read",
  "agent.conversation.session.create",
]

export class DropTesterLiveSessionPermissions1794700000000 implements MigrationInterface {
  name = "DropTesterLiveSessionPermissions1794700000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'review_campaign_tester'
        AND role_permission.permission_key = ANY($1::text[])
    `,
      [LIVE_SESSION_PERMISSION_KEYS],
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN unnest($1::text[]) AS permission(key)
      WHERE role.key = 'review_campaign_tester'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `,
      [LIVE_SESSION_PERMISSION_KEYS],
    )
  }
}
