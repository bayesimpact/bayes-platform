import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * A tester's conversations in a review campaign get a session type of their own,
 * `review_campaign_tester`, in place of `live` (#250). The sessions that carry a campaign move to
 * it, with their relay sub-sessions at any depth, which take their parent's type. No schema change.
 */
export class ReviewCampaignTesterSessionType1792474596946 implements MigrationInterface {
  name = "ReviewCampaignTesterSessionType1792474596946"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH RECURSIVE campaign_sessions AS (
        SELECT session.id
        FROM "conversation_agent_session" AS session
        WHERE session.campaign_id IS NOT NULL
        UNION
        SELECT child.id
        FROM "conversation_agent_session" AS child
        JOIN campaign_sessions AS parent ON child.parent_session_id = parent.id
      )
      UPDATE "conversation_agent_session"
      SET "type" = 'review_campaign_tester'
      WHERE id IN (SELECT id FROM campaign_sessions)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "conversation_agent_session"
      SET "type" = 'live'
      WHERE "type" = 'review_campaign_tester'
    `)
  }
}
