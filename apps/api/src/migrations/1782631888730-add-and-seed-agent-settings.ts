import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAndSeedAgentSettings1782631888730 implements MigrationInterface {
  name = "AddAndSeedAgentSettings1782631888730"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "revision" integer NOT NULL, "instructions" text NOT NULL, "model" character varying NOT NULL, "temperature" numeric(3,2) NOT NULL DEFAULT '0', "locale" character varying NOT NULL, "documents_rag_mode" character varying NOT NULL DEFAULT 'all', "greeting_message" text, "output_json_schema" jsonb, CONSTRAINT "UQ_052b54b2915642ff9211e35551d" UNIQUE ("organization_id", "project_id", "agent_id", "revision"), CONSTRAINT "PK_ffe5afe48bdfd4f8fb00ef1e7e5" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD CONSTRAINT "FK_7708bd77e5ffe5455db0c86e6cc" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    //remove orphans messages due to a fixed issue
    await queryRunner.query(`
    DELETE FROM agent_message AS am
    WHERE NOT EXISTS (SELECT DISTINCT 1 FROM form_agent_session AS fas WHERE fas.id = am.session_id)
    AND NOT EXISTS (SELECT DISTINCT 1 FROM conversation_agent_session AS cas WHERE cas.id = am.session_id)
    AND NOT EXISTS (SELECT DISTINCT 1 FROM extraction_agent_session AS eas WHERE eas.id = am.session_id)
    AND NOT EXISTS (SELECT DISTINCT 1 FROM public_agent_session AS pas WHERE pas.id = am.session_id)
    `)

    await queryRunner.query(`
    INSERT INTO "agent_settings" ("id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id", "agent_id", "revision", "instructions", "model", "temperature", "locale", "documents_rag_mode", "greeting_message", "output_json_schema")
    SELECT uuid_generate_v4(), "created_at", "updated_at", "deleted_at", "organization_id", "project_id", "id", 1, "default_prompt", "model", "temperature", "locale", "documents_rag_mode", "greeting_message", "output_json_schema"
    FROM agent
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" DROP CONSTRAINT "FK_7708bd77e5ffe5455db0c86e6cc"`,
    )
    await queryRunner.query(`DROP TABLE "agent_settings"`)
  }
}
