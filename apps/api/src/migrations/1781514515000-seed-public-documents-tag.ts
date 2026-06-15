import { randomUUID } from "node:crypto"
import type { MigrationInterface, QueryRunner } from "typeorm"

export class SeedPublicDocumentsTag1781514515000 implements MigrationInterface {
  name = "SeedPublicDocumentsTag1781514515000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create a `public-documents` tag for every project that does not already have one.
    const projects: { id: string; organization_id: string }[] = await queryRunner.query(
      `SELECT id, organization_id FROM project WHERE deleted_at IS NULL`,
    )

    const now = new Date()

    for (const project of projects) {
      const existing: { id: string }[] = await queryRunner.query(
        `SELECT id FROM document_tag
         WHERE project_id = $1 AND name = 'public-documents' AND deleted_at IS NULL`,
        [project.id],
      )
      if (existing.length === 0) {
        await queryRunner.query(
          `INSERT INTO document_tag (id, organization_id, project_id, name, description, parent_id, created_at, updated_at)
           VALUES ($1, $2, $3, 'public-documents', NULL, NULL, $4, $4)`,
          [randomUUID(), project.organization_id, project.id, now],
        )
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM document_tag WHERE name = 'public-documents'`)
  }
}
