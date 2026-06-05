import type { MigrationInterface, QueryRunner } from "typeorm"

export class CreateAgentSubAgent1779909374924 implements MigrationInterface {
  name = "CreateAgentSubAgent1779909374924"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_sub_agent" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "parent_agent_id" uuid NOT NULL, "child_agent_id" uuid NOT NULL, "tool_name" character varying(64) NOT NULL, "description" text NOT NULL DEFAULT '', "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_72d4978eb9b4341402f39e9c8c5" UNIQUE ("parent_agent_id", "tool_name"), CONSTRAINT "UQ_e1361459627fc9fc9e0fa41d9e3" UNIQUE ("parent_agent_id", "child_agent_id"), CONSTRAINT "PK_9dae75f33df4e5db0096fbd2802" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_sub_agent" ADD CONSTRAINT "FK_0700deff477b3214a1b184589cf" FOREIGN KEY ("parent_agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_sub_agent" ADD CONSTRAINT "FK_8faefc512553078c6ea68965cd2" FOREIGN KEY ("child_agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_sub_agent" DROP CONSTRAINT "FK_8faefc512553078c6ea68965cd2"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_sub_agent" DROP CONSTRAINT "FK_0700deff477b3214a1b184589cf"`,
    )
    await queryRunner.query(`DROP TABLE "agent_sub_agent"`)
  }
}
