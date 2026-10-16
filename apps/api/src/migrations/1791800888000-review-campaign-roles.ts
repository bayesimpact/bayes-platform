import type { MigrationInterface, QueryRunner } from "typeorm"

const TESTER_PERMISSIONS = [
  "review_campaign.read",
  "review_campaign.tester_session.read",
  "review_campaign.tester_session.create",
  "review_campaign.tester_session.delete",
  "review_campaign.tester_feedback.create",
  "review_campaign.tester_feedback.update",
  "review_campaign.tester_survey.read",
  "review_campaign.tester_survey.create",
  "review_campaign.tester_survey.update",
  "project.read",
  "agent.conversation.session.read",
  "agent.conversation.session.create",
  "project.agent_message_feedback.create",
]

const REVIEWER_PERMISSIONS = [
  "review_campaign.read",
  "review_campaign.reviewer_session.read",
  "review_campaign.reviewer_review.create",
  "review_campaign.reviewer_review.update",
  "review_campaign.report.read",
  "project.read",
]

function toValues(permissions: string[]): string {
  return permissions.map((permission) => `('${permission}')`).join(",\n          ")
}

/**
 * Review campaign testers and reviewers get catalog roles held on their `review_campaign` rows:
 * - creates `review_campaign_tester` and `review_campaign_reviewer` (scope `review_campaign`)
 *   and their grants;
 * - grants `review_campaign.report.read` to project owners and admins (passed down to campaigns);
 * - sets `role_id` on the existing `review_campaign` rows from their legacy `role`, only for people
 *   who still hold a project row on the campaign's project: every past acceptance wrote one, so a
 *   missing row means an admin removed the person from the project.
 * The `project_member` rows past invitations gave stay for now. They are removed by a later
 * migration, once every running pod knows the campaign roles.
 * `down` gives a `project_member` row to the people who joined a campaign under these roles (a
 * campaign row holding a role and no project row), as the previous invitation flow did.
 */
export class ReviewCampaignRoles1791800888000 implements MigrationInterface {
  name = "ReviewCampaignRoles1791800888000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role" ("key", "name", "scope_type")
      SELECT new_role.key, new_role.name, 'review_campaign'
      FROM (
        VALUES
          ('review_campaign_tester', 'Review Campaign Tester'),
          ('review_campaign_reviewer', 'Review Campaign Reviewer')
      ) AS new_role(key, name)
      WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "role"."key" = new_role.key)
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ${toValues(TESTER_PERMISSIONS)}
      ) AS permission(key)
      WHERE role.key = 'review_campaign_tester'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ${toValues(REVIEWER_PERMISSIONS)}
      ) AS permission(key)
      WHERE role.key = 'review_campaign_reviewer'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'review_campaign.report.read'
      FROM "role" AS role
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

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

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Runs before role_id is cleared: a campaign row holding a role without a project row was
    // written by the new invitation flow, which no longer gives a project row.
    await queryRunner.query(`
      INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
      SELECT DISTINCT campaign_membership.user_id, 'project', review_campaign.project_id, 'member',
             role.id
      FROM "user_membership" AS campaign_membership
      INNER JOIN "review_campaign" ON review_campaign.id = campaign_membership.resource_id
      CROSS JOIN "role" AS role
      WHERE campaign_membership.resource_type = 'review_campaign'
        AND campaign_membership.deleted_at IS NULL
        AND campaign_membership.role_id IS NOT NULL
        AND role.key = 'project_member'
        AND NOT EXISTS (
          SELECT 1
          FROM "user_membership" AS project_membership
          WHERE project_membership.user_id = campaign_membership.user_id
            AND project_membership.resource_type = 'project'
            AND project_membership.resource_id = review_campaign.project_id
        )
    `)

    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET "role_id" = NULL
      FROM "role" AS role
      WHERE membership.role_id = role.id
        AND membership.resource_type = 'review_campaign'
        AND role.key IN ('review_campaign_tester', 'review_campaign_reviewer')
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key = 'review_campaign.report.read'
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('review_campaign_tester', 'review_campaign_reviewer')
    `)

    await queryRunner.query(
      `DELETE FROM "role" WHERE "key" IN ('review_campaign_tester', 'review_campaign_reviewer')`,
    )
  }
}
