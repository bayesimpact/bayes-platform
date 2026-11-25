import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The models each feature flag used to open to a workspace (a project). Written here rather than
 * read from the code, so the migration keeps meaning the same thing later.
 */
const MODELS_BY_FLAG: Record<string, string[]> = {
  gemma: ["google/gemma-4-26b-A4B-it", "google/gemma-4-31B-it"],
  medgemma: ["google/medgemma-27b-it"],
  mistral: [
    "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
    "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
  ],
  qwen: ["Qwen/Qwen3.8-27B"],
  anthropic: ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5", "claude-opus-5-5"],
  openai: ["gpt-5.4", "gpt-5.4-mini"],
}

/**
 * The two lists of models of a workspace, set from the backoffice:
 * - `project_model`: whether a workspace offers a model of the code;
 * - `custom_model`: a model a workspace adds on a server of its own, which its agents pick through
 *   `agent_settings.custom_model_id`.
 * Each project with one of the `gemma`, `medgemma`, `mistral`, `qwen`, `anthropic` or `openai`
 * flags gets the models of that flag turned on, then the flags are deleted.
 * `backoffice.project_model.update` is granted to `platform_superadmin`.
 */
export class WorkspaceModels1795631371793 implements MigrationInterface {
  name = "WorkspaceModels1795631371793"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "custom_model" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "project_id" uuid NOT NULL, "name" character varying NOT NULL, "base_model" character varying NOT NULL, "base_url" character varying NOT NULL, "api_key_encrypted" text, "served_model_name" character varying, CONSTRAINT "PK_8067e1fe1c2fd84bc833d56a2bf" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "custom_model_project_id_IDX" ON "custom_model" ("project_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "project_model" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "project_id" uuid NOT NULL, "model" character varying NOT NULL, "enabled" boolean NOT NULL, CONSTRAINT "PK_fd8db222d781829002cd50b7a32" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "project_model_project_model_UNIQUE" ON "project_model" ("project_id", "model") `,
    )
    await queryRunner.query(`ALTER TABLE "agent_settings" ADD "custom_model_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "custom_model" ADD CONSTRAINT "FK_6223c3442abaeb2500c6d042ef5" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD CONSTRAINT "FK_e5c10d0b722a19cd510fab7e2b3" FOREIGN KEY ("custom_model_id") REFERENCES "custom_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "project_model" ADD CONSTRAINT "FK_6f45ee3e9379ff08d107c5a68f5" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    for (const [flag, models] of Object.entries(MODELS_BY_FLAG)) {
      await queryRunner.query(
        `
        INSERT INTO "project_model" ("project_id", "model", "enabled")
        SELECT feature_flag.project_id, model.value, true
        FROM "feature_flag" AS feature_flag
        CROSS JOIN unnest($2::varchar[]) AS model(value)
        WHERE feature_flag.feature_flag_key = $1
          AND feature_flag.enabled = true
          AND feature_flag.deleted_at IS NULL
        ON CONFLICT DO NOTHING
        `,
        [flag, models],
      )
    }
    await queryRunner.query(`DELETE FROM "feature_flag" WHERE "feature_flag_key" = ANY($1)`, [
      Object.keys(MODELS_BY_FLAG),
    ])

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'backoffice.project_model.update'
      FROM "role" AS role
      WHERE role.key = 'platform_superadmin'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'platform_superadmin'
        AND role_permission.permission_key = 'backoffice.project_model.update'
    `)

    // A project gets a flag back when it had every model of that flag turned on.
    for (const [flag, models] of Object.entries(MODELS_BY_FLAG)) {
      await queryRunner.query(
        `
        INSERT INTO "feature_flag" ("project_id", "feature_flag_key", "enabled")
        SELECT project_model.project_id, $1, true
        FROM "project_model" AS project_model
        WHERE project_model.model = ANY($2::varchar[]) AND project_model.enabled = true
        GROUP BY project_model.project_id
        HAVING COUNT(*) = cardinality($2::varchar[])
        ON CONFLICT DO NOTHING
        `,
        [flag, models],
      )
    }

    await queryRunner.query(
      `ALTER TABLE "project_model" DROP CONSTRAINT "FK_6f45ee3e9379ff08d107c5a68f5"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_settings" DROP CONSTRAINT "FK_e5c10d0b722a19cd510fab7e2b3"`,
    )
    await queryRunner.query(
      `ALTER TABLE "custom_model" DROP CONSTRAINT "FK_6223c3442abaeb2500c6d042ef5"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "custom_model_id"`)
    await queryRunner.query(`DROP INDEX "public"."project_model_project_model_UNIQUE"`)
    await queryRunner.query(`DROP TABLE "project_model"`)
    await queryRunner.query(`DROP INDEX "public"."custom_model_project_id_IDX"`)
    await queryRunner.query(`DROP TABLE "custom_model"`)
  }
}
