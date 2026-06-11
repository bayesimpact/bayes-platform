import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Manual migration (rename-only, no data loss): "agent categories" actually classify
 * agent sessions, not agents. Renames the tables/columns accordingly:
 * - project_agent_category -> project_session_category
 * - agent_category -> agent_session_category
 * - *_agent_category_id columns -> *_session_category_id
 */
export class RenameAgentCategoriesToSessionCategories1781172960502 implements MigrationInterface {
  name = "RenameAgentCategoriesToSessionCategories1781172960502"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_agent_category" RENAME TO "project_session_category"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_category" RENAME TO "agent_session_category"`)
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME COLUMN "project_agent_category_id" TO "project_session_category_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME COLUMN "agent_category_id" TO "agent_session_category_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME COLUMN "project_agent_category_id" TO "project_session_category_id"`,
    )
    // Rename auto-generated constraint names to the ones TypeORM now expects for the new
    // table/column names (RENAME CONSTRAINT is metadata-only, no re-validation).
    await queryRunner.query(
      `ALTER TABLE "project_session_category" RENAME CONSTRAINT "UQ_d2bbb5cc6fa930f6b18a44d48ca" TO "UQ_2b4a4bdf24773c2263bbe8822fe"`,
    )
    await queryRunner.query(
      `ALTER TABLE "project_session_category" RENAME CONSTRAINT "FK_6ba4238200510c21eeeb35de883" TO "FK_eabf732ec243410059e3777735b"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "UQ_75588dd6aed3dc7c4eba4684823" TO "UQ_6e2e0cab96dd83b353cf17707f4"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "UQ_c6de4d0f001dae31b320505397c" TO "UQ_11534e83d17cc0722a6b75adf7c"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "FK_cd78bec875bd4d049da0bf629f2" TO "FK_868b7715c0c8512775ea0550525"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "FK_c38964e2430170918e3bab398d7" TO "FK_7585f89b991ee69023878cb26c1"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "UQ_fdfc7f508502cebc8affb5d5ae3" TO "UQ_23ee3345a28a6d1bfc9aad6ac6f"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "FK_9640f7be54b609d7c163f112e46" TO "FK_66731a9931f50eec4c4b58a02e3"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "FK_efc8c36c3b2885e226bcb83cb5b" TO "FK_021d2db1af2c3dc236934f1922a"`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "FK_021d2db1af2c3dc236934f1922a" TO "FK_efc8c36c3b2885e226bcb83cb5b"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "FK_66731a9931f50eec4c4b58a02e3" TO "FK_9640f7be54b609d7c163f112e46"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME CONSTRAINT "UQ_23ee3345a28a6d1bfc9aad6ac6f" TO "UQ_fdfc7f508502cebc8affb5d5ae3"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "FK_7585f89b991ee69023878cb26c1" TO "FK_c38964e2430170918e3bab398d7"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "FK_868b7715c0c8512775ea0550525" TO "FK_cd78bec875bd4d049da0bf629f2"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "UQ_11534e83d17cc0722a6b75adf7c" TO "UQ_c6de4d0f001dae31b320505397c"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME CONSTRAINT "UQ_6e2e0cab96dd83b353cf17707f4" TO "UQ_75588dd6aed3dc7c4eba4684823"`,
    )
    await queryRunner.query(
      `ALTER TABLE "project_session_category" RENAME CONSTRAINT "FK_eabf732ec243410059e3777735b" TO "FK_6ba4238200510c21eeeb35de883"`,
    )
    await queryRunner.query(
      `ALTER TABLE "project_session_category" RENAME CONSTRAINT "UQ_2b4a4bdf24773c2263bbe8822fe" TO "UQ_d2bbb5cc6fa930f6b18a44d48ca"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME COLUMN "project_session_category_id" TO "project_agent_category_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session_category" RENAME COLUMN "agent_session_category_id" TO "agent_category_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_session_category" RENAME COLUMN "project_session_category_id" TO "project_agent_category_id"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_session_category" RENAME TO "agent_category"`)
    await queryRunner.query(
      `ALTER TABLE "project_session_category" RENAME TO "project_agent_category"`,
    )
  }
}
