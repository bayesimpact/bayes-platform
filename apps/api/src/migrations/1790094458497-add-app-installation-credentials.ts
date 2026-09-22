import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Apps V0 install: one active AppInstallation per (manifest, project) with a
 * credential pair, service user, custom role, and operator who authorized it.
 */
export class AddAppInstallationCredentials1790094458497 implements MigrationInterface {
  name = "AddAppInstallationCredentials1790094458497"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_installation" ADD "service_user_id" uuid`)
    await queryRunner.query(`ALTER TABLE "app_installation" ADD "custom_role_id" uuid`)
    await queryRunner.query(`ALTER TABLE "app_installation" ADD "client_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "app_installation" ADD "client_secret_hash" character varying`,
    )
    await queryRunner.query(`ALTER TABLE "app_installation" ADD "created_by_user_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "app_installation" ADD "revoked_at" TIMESTAMP WITH TIME ZONE`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_app_installation_client_id" ON "app_installation" ("client_id") WHERE "client_id" IS NOT NULL`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_app_installation_active_manifest_project" ON "app_installation" ("app_manifest_id", "project_id") WHERE "status" = 'active' AND "deleted_at" IS NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "app_installation" ADD CONSTRAINT "FK_90f38dc18334cac2582f89e2836" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "app_installation" ADD CONSTRAINT "FK_cfbdefd58e10bac8829ece340d6" FOREIGN KEY ("service_user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "app_installation" ADD CONSTRAINT "FK_311a8037d8b3ae9c6d7aac4e9a2" FOREIGN KEY ("custom_role_id") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "app_installation" ADD CONSTRAINT "FK_bc50cc811ce243c6cd2ca7969df" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_installation" DROP CONSTRAINT "FK_bc50cc811ce243c6cd2ca7969df"`,
    )
    await queryRunner.query(
      `ALTER TABLE "app_installation" DROP CONSTRAINT "FK_311a8037d8b3ae9c6d7aac4e9a2"`,
    )
    await queryRunner.query(
      `ALTER TABLE "app_installation" DROP CONSTRAINT "FK_cfbdefd58e10bac8829ece340d6"`,
    )
    await queryRunner.query(
      `ALTER TABLE "app_installation" DROP CONSTRAINT "FK_90f38dc18334cac2582f89e2836"`,
    )
    await queryRunner.query(`DROP INDEX "public"."UQ_app_installation_active_manifest_project"`)
    await queryRunner.query(`DROP INDEX "public"."UQ_app_installation_client_id"`)
    await queryRunner.query(`ALTER TABLE "app_installation" DROP COLUMN "revoked_at"`)
    await queryRunner.query(`ALTER TABLE "app_installation" DROP COLUMN "created_by_user_id"`)
    await queryRunner.query(`ALTER TABLE "app_installation" DROP COLUMN "client_secret_hash"`)
    await queryRunner.query(`ALTER TABLE "app_installation" DROP COLUMN "client_id"`)
    await queryRunner.query(`ALTER TABLE "app_installation" DROP COLUMN "custom_role_id"`)
    await queryRunner.query(`ALTER TABLE "app_installation" DROP COLUMN "service_user_id"`)
  }
}
