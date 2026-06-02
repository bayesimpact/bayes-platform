import type { MigrationInterface, QueryRunner } from "typeorm"

export class IndexEvaluationExtractionRunRecordByRunAndStatus1780429003248
  implements MigrationInterface
{
  name = "IndexEvaluationExtractionRunRecordByRunAndStatus1780429003248"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_c17f379c092804abade46043b7"`)
    await queryRunner.query(
      `CREATE INDEX "IDX_e58b9952ddea7ec269333a2778" ON "evaluation_extraction_run_record" ("organization_id", "project_id", "evaluation_extraction_run_id", "status") `,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_e58b9952ddea7ec269333a2778"`)
    await queryRunner.query(
      `CREATE INDEX "IDX_c17f379c092804abade46043b7" ON "evaluation_extraction_run_record" ("organization_id", "project_id") `,
    )
  }
}
