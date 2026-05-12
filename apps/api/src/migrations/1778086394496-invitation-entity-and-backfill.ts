import type { MigrationInterface, QueryRunner } from "typeorm"

export class InvitationEntityAndBackfill1778086394496 implements MigrationInterface {
  name = "InvitationEntityAndBackfill1778086394496"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invitation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "target_type" character varying NOT NULL, "target_id" uuid NOT NULL, "user_id" uuid NOT NULL, "invited_email" character varying, "invitation_token" character varying NOT NULL, "status" character varying NOT NULL, "role" character varying NOT NULL, "invited_at" TIMESTAMP NOT NULL, "accepted_at" TIMESTAMP, CONSTRAINT "UQ_4570a9eb86d536b209003c90438" UNIQUE ("invitation_token"), CONSTRAINT "PK_beb994737756c0f18a1c1f8669c" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_fff32f66ca12d5cf475e6620ff" ON "invitation" ("target_type", "target_id", "status") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_131357ee80865e3c2dd2118556" ON "invitation" ("user_id", "status") `,
    )

    await queryRunner.query(`
      INSERT INTO "invitation" (
        "id", "created_at", "updated_at", "deleted_at",
        "organization_id", "project_id", "target_type", "target_id", "user_id",
        "invited_email", "invitation_token", "status", "role", "invited_at", "accepted_at"
      )
      SELECT
        uuid_generate_v4(),
        pm.created_at,
        pm.updated_at,
        pm.deleted_at,
        p.organization_id,
        p.id,
        'project',
        p.id,
        pm.user_id,
        u.email,
        pm.invitation_token,
        'pending',
        pm.role,
        pm.created_at,
        NULL
      FROM project_membership pm
      INNER JOIN project p ON p.id = pm.project_id
      INNER JOIN "user" u ON u.id = pm.user_id
      WHERE pm.status = 'sent' AND pm.invitation_token IS NOT NULL
    `)

    await queryRunner.query(`
      INSERT INTO "invitation" (
        "id", "created_at", "updated_at", "deleted_at",
        "organization_id", "project_id", "target_type", "target_id", "user_id",
        "invited_email", "invitation_token", "status", "role", "invited_at", "accepted_at"
      )
      SELECT
        uuid_generate_v4(),
        am.created_at,
        am.updated_at,
        am.deleted_at,
        a.organization_id,
        a.project_id,
        'agent',
        a.id,
        am.user_id,
        u.email,
        am.invitation_token,
        'pending',
        am.role,
        am.created_at,
        NULL
      FROM agent_membership am
      INNER JOIN agent a ON a.id = am.agent_id
      INNER JOIN "user" u ON u.id = am.user_id
      WHERE am.status = 'sent' AND am.invitation_token IS NOT NULL
    `)

    await queryRunner.query(`
      INSERT INTO "invitation" (
        "id", "created_at", "updated_at", "deleted_at",
        "organization_id", "project_id", "target_type", "target_id", "user_id",
        "invited_email", "invitation_token", "status", "role", "invited_at", "accepted_at"
      )
      SELECT
        uuid_generate_v4(),
        rcm.created_at,
        rcm.updated_at,
        rcm.deleted_at,
        rcm.organization_id,
        rcm.project_id,
        'review_campaign',
        rcm.campaign_id,
        rcm.user_id,
        u.email,
        rcm.invitation_token,
        'pending',
        rcm.role,
        rcm.invited_at,
        rcm.accepted_at
      FROM review_campaign_membership rcm
      INNER JOIN "user" u ON u.id = rcm.user_id
      WHERE rcm.accepted_at IS NULL AND rcm.invitation_token IS NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_131357ee80865e3c2dd2118556"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_fff32f66ca12d5cf475e6620ff"`)
    await queryRunner.query(`DROP TABLE "invitation"`)
  }
}
