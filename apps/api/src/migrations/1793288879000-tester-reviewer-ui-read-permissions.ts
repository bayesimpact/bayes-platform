import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The tester and reviewer apps get their own permission, like the desk, studio and evaluation
 * apps: `tester.ui.read` on `review_campaign_tester` and `reviewer.ui.read` on
 * `review_campaign_reviewer`. Both apply to the campaign's project, while the campaign status
 * lets the role take part. No schema change, role_permission rows only.
 */
export class TesterReviewerUiReadPermissions1793288879000 implements MigrationInterface {
  name = "TesterReviewerUiReadPermissions1793288879000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, grant_row.permission_key
      FROM "role" AS role
      JOIN (
        VALUES
          ('review_campaign_tester', 'tester.ui.read'),
          ('review_campaign_reviewer', 'reviewer.ui.read')
      ) AS grant_row (role_key, permission_key) ON grant_row.role_key = role.key
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('review_campaign_tester', 'review_campaign_reviewer')
        AND role_permission.permission_key IN ('tester.ui.read', 'reviewer.ui.read')
    `)
  }
}
