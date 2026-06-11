import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Manual migration (rename-only, no data loss): "agent categories" actually classify
 * agent sessions, not agents. Renames the tables/columns accordingly:
 * - project_agent_category -> project_agent_session_category
 * - agent_category -> agent_session_category
 * - *_agent_category_id columns -> *_agent_session_category_id
 */
export class RenameAgentCategoriesToSessionCategories1781172960502 implements MigrationInterface {
  name = "RenameAgentCategoriesToSessionCategories1781172960502"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_agent_category" RENAME TO "project_agent_session_category"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_category" RENAME TO "agent_session_category"`)
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME COLUMN "project_agent_category_id" TO "project_agent_session_category_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME COLUMN "agent_category_id" TO "agent_session_category_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME COLUMN "project_agent_category_id" TO "project_agent_session_category_id"`,
    )
    // Rename auto-generated constraint names to the ones TypeORM now expects for the new
    // table/column names (RENAME CONSTRAINT is metadata-only, no re-validation).
    await queryRunner.query(
      `ALTER TABLE "project_agent_session_category" RENAME CONSTRAINT "UQ_d2bbb5cc6fa930f6b18a44d48ca" TO "UQ_3eb3de0ec02d098221baa491536"`,
    )
    await queryRunner.query(
      `ALTER TABLE "project_agent_session_category" RENAME CONSTRAINT "FK_6ba4238200510c21eeeb35de883" TO "FK_20df9c87691521bf15fa4417c91"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "UQ_75588dd6aed3dc7c4eba4684823" TO "UQ_882e0d3a534822374de516e753d"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "UQ_c6de4d0f001dae31b320505397c" TO "UQ_11534e83d17cc0722a6b75adf7c"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "FK_cd78bec875bd4d049da0bf629f2" TO "FK_868b7715c0c8512775ea0550525"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "FK_c38964e2430170918e3bab398d7" TO "FK_20cd3e26c5478338876bacf4f15"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "UQ_fdfc7f508502cebc8affb5d5ae3" TO "UQ_23ee3345a28a6d1bfc9aad6ac6f"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "FK_9640f7be54b609d7c163f112e46" TO "FK_66731a9931f50eec4c4b58a02e3"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "FK_efc8c36c3b2885e226bcb83cb5b" TO "FK_9eef869c28cd490b2963ff2584f"`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "FK_9eef869c28cd490b2963ff2584f" TO "FK_efc8c36c3b2885e226bcb83cb5b"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "FK_66731a9931f50eec4c4b58a02e3" TO "FK_9640f7be54b609d7c163f112e46"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "UQ_23ee3345a28a6d1bfc9aad6ac6f" TO "UQ_fdfc7f508502cebc8affb5d5ae3"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "FK_20cd3e26c5478338876bacf4f15" TO "FK_c38964e2430170918e3bab398d7"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "FK_868b7715c0c8512775ea0550525" TO "FK_cd78bec875bd4d049da0bf629f2"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "UQ_11534e83d17cc0722a6b75adf7c" TO "UQ_c6de4d0f001dae31b320505397c"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "UQ_882e0d3a534822374de516e753d" TO "UQ_75588dd6aed3dc7c4eba4684823"`,
    )
    await queryRunner.query(
      `ALTER TABLE "project_agent_session_category" RENAME CONSTRAINT "FK_20df9c87691521bf15fa4417c91" TO "FK_6ba4238200510c21eeeb35de883"`,
    )
    await queryRunner.query(
      `ALTER TABLE "project_agent_session_category" RENAME CONSTRAINT "UQ_3eb3de0ec02d098221baa491536" TO "UQ_d2bbb5cc6fa930f6b18a44d48ca"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME COLUMN "project_agent_session_category_id" TO "project_agent_category_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME COLUMN "agent_session_category_id" TO "agent_category_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME COLUMN "project_agent_session_category_id" TO "project_agent_category_id"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_session_category" RENAME TO "agent_category"`)
    await queryRunner.query(
      `ALTER TABLE "project_agent_session_category" RENAME TO "project_agent_category"`,
    )
  }
}
