import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddUserIdOnDocument1778674225641 implements MigrationInterface {
  name = "AddUserIdOnDocument1778674225641"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document" ADD "user_id" uuid`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document" DROP COLUMN "user_id"`)
  }
}
