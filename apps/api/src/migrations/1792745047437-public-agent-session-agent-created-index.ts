import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The review session list and the category analytics read an agent's public (embed/app)
 * sessions newest first: the filter on `agent_id` was not indexed.
 */
export class PublicAgentSessionAgentCreatedIndex1792745047437 implements MigrationInterface {
  name = "PublicAgentSessionAgentCreatedIndex1792745047437"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_ec4e3afad1e8d6cbc7a8016446" ON "public_agent_session" ("agent_id", "created_at") `,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ec4e3afad1e8d6cbc7a8016446"`)
  }
}
