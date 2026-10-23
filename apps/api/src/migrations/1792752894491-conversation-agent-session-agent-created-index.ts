import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The review session list sorts an agent's conversation sessions newest first. The base
 * index on (organization_id, project_id, agent_id, type) covers the filter but not the
 * date sort, which is a top-N sort of every session of the agent.
 */
export class ConversationAgentSessionAgentCreatedIndex1792752894491 implements MigrationInterface {
  name = "ConversationAgentSessionAgentCreatedIndex1792752894491"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_96bcae682cacbc97899fb51cf3" ON "conversation_agent_session" ("organization_id", "project_id", "agent_id", "created_at") `,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_96bcae682cacbc97899fb51cf3"`)
  }
}
