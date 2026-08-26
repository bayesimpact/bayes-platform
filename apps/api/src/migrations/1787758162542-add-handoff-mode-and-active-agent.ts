import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHandoffModeAndActiveAgent1787758162542 implements MigrationInterface {
    name = 'AddHandoffModeAndActiveAgent1787758162542'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation_agent_session" ADD "active_agent_id" uuid`);
        await queryRunner.query(`ALTER TABLE "agent_sub_agent" ADD "mode" character varying NOT NULL DEFAULT 'relay'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent_sub_agent" DROP COLUMN "mode"`);
        await queryRunner.query(`ALTER TABLE "conversation_agent_session" DROP COLUMN "active_agent_id"`);
    }

}
