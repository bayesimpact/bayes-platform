import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Drops the legacy owner / admin / member / tester / reviewer string: the role of a row is
 * `role_id`. The previous release stopped selecting the column, so its pods keep working while
 * this one rolls out. `down` brings the column back empty.
 */
export class DropUserMembershipRole1793267114527 implements MigrationInterface {
  name = "DropUserMembershipRole1793267114527"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_membership" DROP COLUMN "role"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_membership" ADD "role" character varying`)
  }
}
