import type { MigrationInterface, QueryRunner } from "typeorm"

export class AppInstallAuthorizationCode1791533673921 implements MigrationInterface {
  name = "AppInstallAuthorizationCode1791533673921"

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_install_authorization_code" DROP CONSTRAINT "FK_5edc9b19499402746ce00e1dfec"`,
    )
    await queryRunner.query(`DROP INDEX "public"."UQ_app_install_authorization_code_hash"`)
    await queryRunner.query(`DROP TABLE "app_install_authorization_code"`)
  }
}
