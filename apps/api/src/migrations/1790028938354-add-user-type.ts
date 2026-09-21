import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Apps V0 service users: discriminant on `user` so install identities can
 * share the User table without authenticating through Auth0. Existing rows
 * stay `human` via the column default.
 */
export class AddUserType1790028938354 implements MigrationInterface {
  name = "AddUserType1790028938354"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "type" character varying NOT NULL DEFAULT 'human'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "type"`)
  }
}
