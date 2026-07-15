import type { MigrationInterface, QueryRunner } from "typeorm"

export class GlobalUserMembership1784000000000 implements MigrationInterface {
  name = "GlobalUserMembership1784000000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_membership" ALTER COLUMN "resource_id" DROP NOT NULL`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_membership_global" ON "user_membership" ("user_id", "role_id") WHERE "resource_type" = 'global'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_user_membership_global"`)
    await queryRunner.query(`ALTER TABLE "user_membership" ALTER COLUMN "resource_id" SET NOT NULL`)
  }
}
