import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Existing sources were created by an installed app before the foreign key existed.
 * The create activity has no entity id, so the latest update activity is the link.
 */
export class BackfillDocumentSourceAppInstallation1790860100000 implements MigrationInterface {
  name = "BackfillDocumentSourceAppInstallation1790860100000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "document_source"
      SET "app_installation_id" = matched.installation_id
      FROM (
        SELECT DISTINCT ON (activity.entity_id)
          activity.entity_id AS source_id,
          installation.id AS installation_id
        FROM "activity"
        INNER JOIN "app_installation" installation
          ON installation.service_user_id = activity.user_id
          AND installation.deleted_at IS NULL
        INNER JOIN "document_source" source
          ON source.id = activity.entity_id
          AND source.project_id = installation.project_id
        WHERE activity.entity_type = 'documentSource'
          AND activity.entity_id IS NOT NULL
        ORDER BY
          activity.entity_id,
          CASE WHEN installation.status = 'active' THEN 0 ELSE 1 END,
          activity.created_at DESC
      ) matched
      WHERE "document_source".id = matched.source_id
        AND "document_source".app_installation_id IS NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "document_source" source
      SET "app_installation_id" = NULL
      FROM "activity"
      INNER JOIN "app_installation" installation
        ON installation.service_user_id = activity.user_id
      WHERE activity.entity_type = 'documentSource'
        AND activity.entity_id = source.id
        AND source.app_installation_id = installation.id
    `)
  }
}
