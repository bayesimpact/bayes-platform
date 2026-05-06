import type { MigrationInterface, QueryRunner } from "typeorm"

export class TermsCompliance1777988399974 implements MigrationInterface {
  name = "TermsCompliance1777988399974"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "terms_document" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "type" character varying NOT NULL, "url" character varying NOT NULL, "version" integer NOT NULL, CONSTRAINT "PK_cb69ddef9302f84896f1bce795d" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_37682772d64295fd3f58172b7c" ON "terms_document" ("type") WHERE "deleted_at" IS NULL`,
    )
    await queryRunner.query(
      `CREATE TABLE "terms_acceptance" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "general_conditions_url" character varying NOT NULL, "general_conditions_version" integer NOT NULL, "privacy_policy_url" character varying NOT NULL, "privacy_policy_version" integer NOT NULL, "ai_usage_policy_url" character varying NOT NULL, "ai_usage_policy_version" integer NOT NULL, "ai_usage_policy_accepted" boolean NOT NULL, CONSTRAINT "PK_23370d00ad2d55a97e1237f4594" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_4ae7a2f8bef1abdf58d4159814" ON "terms_acceptance" ("user_id", "created_at") `,
    )
    await queryRunner.query(
      `ALTER TABLE "terms_acceptance" ADD CONSTRAINT "FK_2e0669dab32356a4395ff9228d4" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    // Seed the three required terms documents at version 1 with placeholder
    // URLs. Backoffice users update them to real links before going live.
    await queryRunner.query(
      `INSERT INTO "terms_document" ("type", "url", "version") VALUES
        ('general_conditions', '', 0),
        ('privacy_policy', '', 0),
        ('ai_usage_policy', '', 0)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "terms_acceptance" DROP CONSTRAINT "FK_2e0669dab32356a4395ff9228d4"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_4ae7a2f8bef1abdf58d4159814"`)
    await queryRunner.query(`DROP TABLE "terms_acceptance"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_37682772d64295fd3f58172b7c"`)
    await queryRunner.query(`DROP TABLE "terms_document"`)
  }
}
