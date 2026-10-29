import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * A `user_membership` row is the role it holds, so `role_id` becomes NOT NULL. The rows still
 * without one grant nothing and every reader skips them: campaign rows of people removed from the
 * project, which the review campaign role backfills left without a role on purpose. They are
 * deleted, soft-deleted ones included, and `down` does not bring them back.
 * The legacy `role` column stays: pods of the previous release still select it while this one
 * rolls out. The next release drops it.
 */
export class UserMembershipRoleIdNotNull1793265000164 implements MigrationInterface {
  name = "UserMembershipRoleIdNotNull1793265000164"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "user_membership" WHERE "role_id" IS NULL`)
    await queryRunner.query(`ALTER TABLE "user_membership" ALTER COLUMN "role_id" SET NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_membership" ALTER COLUMN "role_id" DROP NOT NULL`)
  }
}
