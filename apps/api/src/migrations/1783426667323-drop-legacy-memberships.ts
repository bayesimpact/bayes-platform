import type { MigrationInterface, QueryRunner } from "typeorm"

export class DropLegacyMemberships1783426667323 implements MigrationInterface {
  name = "DropLegacyMemberships1783426667323"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "review_campaign_membership"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_membership"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "project_membership"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_membership"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "organization_membership" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "role" character varying NOT NULL,
        CONSTRAINT "PK_79d3d7350ae33ad6fe1743df86c" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ca24d6d1a91810c7decccf091c3" UNIQUE ("user_id", "organization_id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE "project_membership" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "role" character varying NOT NULL,
        CONSTRAINT "PK_project_membership_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_membership_user_project" UNIQUE ("user_id", "project_id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE "agent_membership" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "agent_id" uuid NOT NULL,
        "role" character varying NOT NULL,
        CONSTRAINT "PK_agent_membership_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agent_membership_user_agent" UNIQUE ("user_id", "agent_id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE "review_campaign_membership" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "campaign_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" character varying NOT NULL,
        "accepted_at" TIMESTAMP,
        CONSTRAINT "PK_review_campaign_membership_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_review_campaign_membership_user_campaign_role" UNIQUE ("campaign_id", "user_id", "role")
      )
    `)
  }
}
