import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Document feeds for installed apps, plus the project owner/admin grants.
 * The partial unique index is declared on the entity so later generates keep it.
 */
export class AddDocumentSource1790421266270 implements MigrationInterface {
  name = "AddDocumentSource1790421266270"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_source" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "name" character varying NOT NULL, "type" character varying, "external_id" character varying, "base_url" text, "config" jsonb, CONSTRAINT "PK_d61cb2fa3cf03ec92a6e37df51e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_93a16f31b5d217858cab5da3f7" ON "document_source" ("organization_id", "project_id") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "document_source_project_external_id_unique" ON "document_source" ("project_id", "external_id") WHERE "external_id" IS NOT NULL`,
    )
    await queryRunner.query(`ALTER TABLE "document" ADD "document_source_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "document_source" ADD CONSTRAINT "FK_1dbf336595ae6f291e7bba354e0" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "document" ADD CONSTRAINT "FK_15faaf2a3c829d2a621352ebe7a" FOREIGN KEY ("document_source_id") REFERENCES "document_source"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    )
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('document_source.read'),
          ('document_source.create'),
          ('document_source.update'),
          ('document_source.delete')
      ) AS permission(key)
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key IN (
          'document_source.read',
          'document_source.create',
          'document_source.update',
          'document_source.delete'
        )
    `)
    await queryRunner.query(
      `ALTER TABLE "document" DROP CONSTRAINT "FK_15faaf2a3c829d2a621352ebe7a"`,
    )
    await queryRunner.query(
      `ALTER TABLE "document_source" DROP CONSTRAINT "FK_1dbf336595ae6f291e7bba354e0"`,
    )
    await queryRunner.query(`ALTER TABLE "document" DROP COLUMN "document_source_id"`)
    await queryRunner.query(`DROP INDEX "public"."document_source_project_external_id_unique"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_93a16f31b5d217858cab5da3f7"`)
    await queryRunner.query(`DROP TABLE "document_source"`)
  }
}
