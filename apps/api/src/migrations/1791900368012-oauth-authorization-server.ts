import type { MigrationInterface, QueryRunner } from "typeorm"

export class OauthAuthorizationServer1791900368012 implements MigrationInterface {
  name = "OauthAuthorizationServer1791900368012"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "oauth_client" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "client_id" character varying(2048) NOT NULL, "registration_type" character varying(8) NOT NULL, "client_name" character varying(200), "redirect_uris" jsonb NOT NULL, "metadata_fetched_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d6e58a7e0ec3ac17a67ba7f97cd" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_oauth_client_client_id" ON "oauth_client" ("client_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "oauth_grant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "oauth_client_id" uuid NOT NULL, "permissions" jsonb NOT NULL, "resource" character varying(2048) NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "last_used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7ef975b60977497b796babe82ca" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "IDX_oauth_grant_user_id" ON "oauth_grant" ("user_id") `)
    await queryRunner.query(
      `CREATE TABLE "oauth_refresh_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "token_hash" character varying NOT NULL, "oauth_grant_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_662a1052b3332c19fb979ff1825" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_oauth_refresh_token_hash" ON "oauth_refresh_token" ("token_hash") `,
    )
    await queryRunner.query(
      `CREATE TABLE "oauth_authorization_code" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "code_hash" character varying NOT NULL, "oauth_grant_id" uuid NOT NULL, "redirect_uri" character varying(2048) NOT NULL, "code_challenge" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "consumed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0bf55695b94d317034bbff8afb9" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_oauth_authorization_code_hash" ON "oauth_authorization_code" ("code_hash") `,
    )
    await queryRunner.query(
      `CREATE TABLE "oauth_grant_project" ("oauth_grant_id" uuid NOT NULL, "project_id" uuid NOT NULL, CONSTRAINT "PK_d4cf332e2ed8411bba4655962a5" PRIMARY KEY ("oauth_grant_id", "project_id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_6664619450db16e7c02dd06ffe" ON "oauth_grant_project" ("oauth_grant_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_44deac5433c0f39b3e08e20e05" ON "oauth_grant_project" ("project_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" ADD CONSTRAINT "FK_86155d6f027cbd4e4ae8ed77ac6" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" ADD CONSTRAINT "FK_930662364fa45f3472ad826ddff" FOREIGN KEY ("oauth_client_id") REFERENCES "oauth_client"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "FK_27d26629af4bee97134e9f39e8f" FOREIGN KEY ("oauth_grant_id") REFERENCES "oauth_grant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_authorization_code" ADD CONSTRAINT "FK_76dcc872fff3138b6ccdeab2ada" FOREIGN KEY ("oauth_grant_id") REFERENCES "oauth_grant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant_project" ADD CONSTRAINT "FK_6664619450db16e7c02dd06ffe7" FOREIGN KEY ("oauth_grant_id") REFERENCES "oauth_grant"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant_project" ADD CONSTRAINT "FK_44deac5433c0f39b3e08e20e05e" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauth_grant_project" DROP CONSTRAINT "FK_44deac5433c0f39b3e08e20e05e"`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant_project" DROP CONSTRAINT "FK_6664619450db16e7c02dd06ffe7"`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_authorization_code" DROP CONSTRAINT "FK_76dcc872fff3138b6ccdeab2ada"`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_refresh_token" DROP CONSTRAINT "FK_27d26629af4bee97134e9f39e8f"`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" DROP CONSTRAINT "FK_930662364fa45f3472ad826ddff"`,
    )
    await queryRunner.query(
      `ALTER TABLE "oauth_grant" DROP CONSTRAINT "FK_86155d6f027cbd4e4ae8ed77ac6"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_44deac5433c0f39b3e08e20e05"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_6664619450db16e7c02dd06ffe"`)
    await queryRunner.query(`DROP TABLE "oauth_grant_project"`)
    await queryRunner.query(`DROP INDEX "public"."UQ_oauth_authorization_code_hash"`)
    await queryRunner.query(`DROP TABLE "oauth_authorization_code"`)
    await queryRunner.query(`DROP INDEX "public"."UQ_oauth_refresh_token_hash"`)
    await queryRunner.query(`DROP TABLE "oauth_refresh_token"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_oauth_grant_user_id"`)
    await queryRunner.query(`DROP TABLE "oauth_grant"`)
    await queryRunner.query(`DROP INDEX "public"."UQ_oauth_client_client_id"`)
    await queryRunner.query(`DROP TABLE "oauth_client"`)
  }
}
