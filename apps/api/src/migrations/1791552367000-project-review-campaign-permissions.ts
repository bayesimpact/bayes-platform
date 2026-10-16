import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The review campaign editor moves to RBAC, with the same people the legacy guard let in:
 * `project.review_campaign.read`, `.create`, `.update`, `.delete` and `.member.delete`
 * on project owner/admin only. No schema change, role_permission rows only.
 */
export class ProjectReviewCampaignPermissions1791552367000 implements MigrationInterface {
  name = "ProjectReviewCampaignPermissions1791552367000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('project.review_campaign.read'),
          ('project.review_campaign.create'),
          ('project.review_campaign.update'),
          ('project.review_campaign.delete'),
          ('project.review_campaign.member.delete')
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
        AND role_permission.permission_key IN (
          'project.review_campaign.read',
          'project.review_campaign.create',
          'project.review_campaign.update',
          'project.review_campaign.delete',
          'project.review_campaign.member.delete'
        )
    `)
  }
}
