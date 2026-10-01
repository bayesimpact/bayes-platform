import type { MigrationInterface, QueryRunner } from "typeorm"

export class DocumentSourceAppInstallation1790859008874 implements MigrationInterface {
  name = "DocumentSourceAppInstallation1790859008874"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document_source" ADD "app_installation_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "document_source" ADD CONSTRAINT "FK_b44e5ade378fd2da24cf4c01ea7" FOREIGN KEY ("app_installation_id") REFERENCES "app_installation"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_source" DROP CONSTRAINT "FK_b44e5ade378fd2da24cf4c01ea7"`,
    )
    await queryRunner.query(`ALTER TABLE "document_source" DROP COLUMN "app_installation_id"`)
  }
}
