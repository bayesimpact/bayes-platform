import type { MigrationInterface, QueryRunner } from "typeorm"

export class DropUrlsFromTermsAcceptance1778070486370 implements MigrationInterface {
  name = "DropUrlsFromTermsAcceptance1778070486370"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "terms_acceptance" DROP COLUMN "general_conditions_url"`)
    await queryRunner.query(`ALTER TABLE "terms_acceptance" DROP COLUMN "privacy_policy_url"`)
    await queryRunner.query(`ALTER TABLE "terms_acceptance" DROP COLUMN "ai_usage_policy_url"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "terms_acceptance" ADD "ai_usage_policy_url" character varying NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "terms_acceptance" ADD "privacy_policy_url" character varying NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "terms_acceptance" ADD "general_conditions_url" character varying NOT NULL`,
    )
  }
}
