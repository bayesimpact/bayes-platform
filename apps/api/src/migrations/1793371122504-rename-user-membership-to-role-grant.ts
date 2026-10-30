import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Renames `user_membership` to `role_grant`: a row is one role a person holds on a resource, or a
 * global role, never a membership (ADR 0032). The rows stay in place. The primary key, the two
 * unique indexes and the two foreign keys take the names TypeORM derives from the new table, so
 * `migration:generate` sees no drift.
 *
 * Written by hand: `migration:generate` cannot express a rename and would create an empty table.
 * Pods still on the previous release fail on the old table name until the rollout ends.
 */
export class RenameUserMembershipToRoleGrant1793371122504 implements MigrationInterface {
  name = "RenameUserMembershipToRoleGrant1793371122504"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_membership" RENAME TO "role_grant"`)
    await queryRunner.query(
      `ALTER TABLE "role_grant" RENAME CONSTRAINT "PK_user_membership_id" TO "PK_role_grant_id"`,
    )
    await queryRunner.query(`ALTER INDEX "UQ_user_membership_role" RENAME TO "UQ_role_grant_role"`)
    await queryRunner.query(
      `ALTER INDEX "UQ_user_membership_global" RENAME TO "UQ_role_grant_global"`,
    )
    await queryRunner.query(
      `ALTER TABLE "role_grant" RENAME CONSTRAINT "FK_13c0b9b73e272c78393908bfe31" TO "FK_cbca8b01eca20fa033ef14946b2"`,
    )
    await queryRunner.query(
      `ALTER TABLE "role_grant" RENAME CONSTRAINT "FK_15769b778a7b5cdbf717e460530" TO "FK_e340b5f73a9294ae6610637fd6c"`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role_grant" RENAME CONSTRAINT "FK_e340b5f73a9294ae6610637fd6c" TO "FK_15769b778a7b5cdbf717e460530"`,
    )
    await queryRunner.query(
      `ALTER TABLE "role_grant" RENAME CONSTRAINT "FK_cbca8b01eca20fa033ef14946b2" TO "FK_13c0b9b73e272c78393908bfe31"`,
    )
    await queryRunner.query(
      `ALTER INDEX "UQ_role_grant_global" RENAME TO "UQ_user_membership_global"`,
    )
    await queryRunner.query(`ALTER INDEX "UQ_role_grant_role" RENAME TO "UQ_user_membership_role"`)
    await queryRunner.query(
      `ALTER TABLE "role_grant" RENAME CONSTRAINT "PK_role_grant_id" TO "PK_user_membership_id"`,
    )
    await queryRunner.query(`ALTER TABLE "role_grant" RENAME TO "user_membership"`)
  }
}
