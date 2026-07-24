import type { MigrationInterface, QueryRunner } from "typeorm"

export class RbacFoundation1783955404972 implements MigrationInterface {
  name = "RbacFoundation1783955404972"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "key" character varying NOT NULL, "name" character varying NOT NULL, "scope_type" character varying NOT NULL, CONSTRAINT "UQ_128d7c8c9af53479d0b9e00eb58" UNIQUE ("key"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "role_permission" ("role_id" uuid NOT NULL, "permission_key" character varying NOT NULL, CONSTRAINT "PK_role_permission_role_id_permission_key" PRIMARY KEY ("role_id", "permission_key"))`,
    )
    await queryRunner.query(`ALTER TABLE "user_membership" ADD "role_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "user_membership" ADD CONSTRAINT "FK_15769b778a7b5cdbf717e460530" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_3d0a7155eafd75ddba5a7013368" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "user_membership" ALTER COLUMN "resource_id" DROP NOT NULL`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_membership_global" ON "user_membership" ("user_id", "role_id") WHERE "resource_type" = 'global'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_user_membership_global"`)
    await queryRunner.query(`DELETE FROM "user_membership" WHERE "resource_type" = 'global'`)
    await queryRunner.query(`ALTER TABLE "user_membership" ALTER COLUMN "resource_id" SET NOT NULL`)
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_3d0a7155eafd75ddba5a7013368"`,
    )
    await queryRunner.query(
      `ALTER TABLE "user_membership" DROP CONSTRAINT "FK_15769b778a7b5cdbf717e460530"`,
    )
    await queryRunner.query(`ALTER TABLE "user_membership" DROP COLUMN "role_id"`)
    await queryRunner.query(`DROP TABLE "role_permission"`)
    await queryRunner.query(`DROP TABLE "role"`)
  }
}
