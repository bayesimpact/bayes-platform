import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The tester, reviewer and report routes now check the campaign role (`role_id`) instead of the
 * legacy `role` column. Pods running the code from before `ReviewCampaignRoles1791800888000` kept
 * writing campaign rows without `role_id` while that change rolled out, so this re-runs its
 * backfill with the same filter: only people who still hold a project row on the campaign's
 * project, since a missing row means an admin removed them from the project.
 * `down` keeps the roles: `ReviewCampaignRoles1791800888000` clears every campaign `role_id` when
 * it is reverted, and a row filled here gives no access its project row does not already give.
 */
export class ReviewCampaignRolesBackfill1792143739000 implements MigrationInterface {
  name = "ReviewCampaignRolesBackfill1792143739000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET "role_id" = role.id
      FROM "role" AS role
      WHERE membership.resource_type = 'review_campaign'
        AND membership.role_id IS NULL
        AND role.key = 'review_campaign_' || membership.role
        AND membership.role IN ('tester', 'reviewer')
        AND EXISTS (
          SELECT 1
          FROM "review_campaign"
          INNER JOIN "user_membership" AS project_membership
            ON project_membership.resource_id = review_campaign.project_id
            AND project_membership.resource_type = 'project'
            AND project_membership.deleted_at IS NULL
          WHERE review_campaign.id = membership.resource_id
            AND project_membership.user_id = membership.user_id
        )
    `)
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
