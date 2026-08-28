import { MigrationInterface, QueryRunner } from "typeorm";

export class AddForceConclusionEnabledToAgentSubAgent1787927999838 implements MigrationInterface {
    name = 'AddForceConclusionEnabledToAgentSubAgent1787927999838'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent_sub_agent" ADD "force_conclusion_enabled" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent_sub_agent" DROP COLUMN "force_conclusion_enabled"`);
    }

}
