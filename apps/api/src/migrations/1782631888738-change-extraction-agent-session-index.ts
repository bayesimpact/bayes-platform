import type { MigrationInterface, QueryRunner } from "typeorm"

export class ChangeExtractionAgentSessionIndex1782631888738 implements MigrationInterface {
  name = "ChangeExtractionAgentSessionIndex1782631888738"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_61a7816417e62c32c400c3276e"`)
    await queryRunner.query(
      `CREATE INDEX "IDX_0265961715502352d8616dd687" ON "extraction_agent_session" ("organization_id", "project_id", "agent_settings_id", "created_at") `,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_0265961715502352d8616dd687"`)
    await queryRunner.query(
      `CREATE INDEX "IDX_61a7816417e62c32c400c3276e" ON "extraction_agent_session" ("agent_id", "created_at", "organization_id", "project_id") `,
    )
  }
}
