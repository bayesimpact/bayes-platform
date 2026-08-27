import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddNextChildAgentToSubAgent1787851204887 implements MigrationInterface {
  name = "AddNextChildAgentToSubAgent1787851204887"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_sub_agent" ADD "next_child_agent_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "agent_sub_agent" ADD CONSTRAINT "FK_b13b2db7265dc54d8c7896c06b4" FOREIGN KEY ("next_child_agent_id") REFERENCES "agent"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_sub_agent" DROP CONSTRAINT "FK_b13b2db7265dc54d8c7896c06b4"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_sub_agent" DROP COLUMN "next_child_agent_id"`)
  }
}
