import type { MigrationInterface, QueryRunner } from "typeorm"

export class InvitationUserIdNullable1778166336752 implements MigrationInterface {
  name = "InvitationUserIdNullable1778166336752"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invitation" ALTER COLUMN "user_id" DROP NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invitation" ALTER COLUMN "user_id" SET NOT NULL`)
  }
}
