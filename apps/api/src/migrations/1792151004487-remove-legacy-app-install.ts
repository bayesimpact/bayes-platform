import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Removes the install flow of ADR 0024: apps install through the OAuth server
 * (ADR 0029). Installations made with the old flow lose their per-installation
 * credentials but stay active: their app reconnects from the consent page and
 * keeps the installation, with its conversations and document sources. The
 * global `app.install` goes with the old endpoints.
 */
export class RemoveLegacyAppInstall1792151004487 implements MigrationInterface {
  name = "RemoveLegacyAppInstall1792151004487"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_install_authorization_code"`)
    await queryRunner.query(`DROP INDEX "public"."UQ_app_installation_client_id"`)
    await queryRunner.query(`ALTER TABLE "app_installation" DROP COLUMN "client_id"`)
    await queryRunner.query(`ALTER TABLE "app_installation" DROP COLUMN "client_secret_hash"`)
    await queryRunner.query(`DELETE FROM "role_permission" WHERE "permission_key" = 'app.install'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'app.install'
      FROM "role" AS role
      WHERE role.key IN ('platform_staff', 'platform_superadmin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
    // The per-installation credentials do not come back: those apps install again.
    await queryRunner.query(
      `ALTER TABLE "app_installation" ADD "client_secret_hash" character varying`,
    )
    await queryRunner.query(`ALTER TABLE "app_installation" ADD "client_id" uuid`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_app_installation_client_id" ON "app_installation" ("client_id") WHERE (client_id IS NOT NULL)`,
    )
    await queryRunner.query(
      `CREATE TABLE "app_install_authorization_code" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "code_hash" character varying NOT NULL, "app_installation_id" uuid NOT NULL, "client_id" uuid NOT NULL, "client_secret" character varying, "redirect_uri" character varying NOT NULL, "code_challenge" character varying NOT NULL, "code_challenge_method" character varying(8) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "consumed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e8bbe137903f06718145aeee587" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_app_install_authorization_code_hash" ON "app_install_authorization_code" ("code_hash") `,
    )
    await queryRunner.query(
      `ALTER TABLE "app_install_authorization_code" ADD CONSTRAINT "FK_5edc9b19499402746ce00e1dfec" FOREIGN KEY ("app_installation_id") REFERENCES "app_installation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }
}
