import type { MigrationInterface, QueryRunner } from "typeorm"

export class OAuthAppClients1792139357110 implements MigrationInterface {
  name = "OAuthAppClients1792139357110"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "oauth_client" ADD "app_manifest_id" uuid`)
    await queryRunner.query(`ALTER TABLE "oauth_client" ADD "client_secret_hash" character varying`)
    await queryRunner.query(`ALTER TABLE "oauth_grant" ADD "app_installation_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" DROP CONSTRAINT "FK_86155d6f027cbd4e4ae8ed77ac6"`,
    )
    await queryRunner.query(`ALTER TABLE "oauth_grant" ALTER COLUMN "user_id" DROP NOT NULL`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_oauth_client_app_manifest_id" ON "oauth_client" ("app_manifest_id") WHERE "app_manifest_id" IS NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_client" ADD CONSTRAINT "FK_88ed7dd95e03898900a3ed4d4b7" FOREIGN KEY ("app_manifest_id") REFERENCES "app_manifest"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" ADD CONSTRAINT "FK_86155d6f027cbd4e4ae8ed77ac6" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" ADD CONSTRAINT "FK_8c1468c56684fedfa2f249b0d57" FOREIGN KEY ("app_installation_id") REFERENCES "app_installation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" DROP CONSTRAINT "FK_8c1468c56684fedfa2f249b0d57"`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" DROP CONSTRAINT "FK_86155d6f027cbd4e4ae8ed77ac6"`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_client" DROP CONSTRAINT "FK_88ed7dd95e03898900a3ed4d4b7"`,
    )
    await queryRunner.query(`DROP INDEX "public"."UQ_oauth_client_app_manifest_id"`)
    // App grants belong to no person: they cannot stay once user_id is required again.
    await queryRunner.query(`DELETE FROM "oauth_grant" WHERE "user_id" IS NULL`)
    await queryRunner.query(`ALTER TABLE "oauth_grant" ALTER COLUMN "user_id" SET NOT NULL`)
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" ADD CONSTRAINT "FK_86155d6f027cbd4e4ae8ed77ac6" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(`ALTER TABLE "oauth_grant" DROP COLUMN "app_installation_id"`)
    await queryRunner.query(`ALTER TABLE "oauth_client" DROP COLUMN "client_secret_hash"`)
    await queryRunner.query(`ALTER TABLE "oauth_client" DROP COLUMN "app_manifest_id"`)
  }
}
