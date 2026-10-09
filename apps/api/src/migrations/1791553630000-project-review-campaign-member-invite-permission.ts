import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Review campaign invitations get their own key, held by the same people as before:
 * `project.review_campaign.member.invite` on project owner/admin only.
 * No schema change, role_permission rows only.
 */
export class ProjectReviewCampaignMemberInvitePermission1791553630000
  implements MigrationInterface
{
  name = "ProjectReviewCampaignMemberInvitePermission1791553630000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('project.review_campaign.member.invite')
      ) AS permission(key)
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key IN ('project.review_campaign.member.invite')
    `)
  }
}
