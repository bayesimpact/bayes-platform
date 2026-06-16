import type { MigrationInterface, QueryRunner } from "typeorm"

export class ResourceLibraries1781541725064 implements MigrationInterface {
  name = "ResourceLibraries1781541725064"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "resource_library" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "title" character varying NOT NULL, "resources" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_cc2d004557e4951d4b2aede8f6d" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_645c21e8d26e51cc7b2b705507" ON "resource_library" ("organization_id", "project_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "agent_resource_library" ("agent_id" uuid NOT NULL, "resource_library_id" uuid NOT NULL, CONSTRAINT "PK_45698d91f2863a804554ec9bbb2" PRIMARY KEY ("agent_id", "resource_library_id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_68a9f273741584a432055a9859" ON "agent_resource_library" ("agent_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_c4d21b718696020cf70311d6b8" ON "agent_resource_library" ("resource_library_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_resource_library" ADD CONSTRAINT "FK_68a9f273741584a432055a9859e" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_resource_library" ADD CONSTRAINT "FK_c4d21b718696020cf70311d6b8e" FOREIGN KEY ("resource_library_id") REFERENCES "resource_library"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_resource_library" DROP CONSTRAINT "FK_c4d21b718696020cf70311d6b8e"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_resource_library" DROP CONSTRAINT "FK_68a9f273741584a432055a9859e"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_c4d21b718696020cf70311d6b8"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_68a9f273741584a432055a9859"`)
    await queryRunner.query(`DROP TABLE "agent_resource_library"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_645c21e8d26e51cc7b2b705507"`)
    await queryRunner.query(`DROP TABLE "resource_library"`)
  }
}
