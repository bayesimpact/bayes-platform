import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Phase 1 of the RBAC migration: seed the 11 canonical roles and backfill
 * `user_role` from the four legacy membership tables. The legacy tables remain
 * the authoritative write path; this migration only mirrors their accepted-state
 * rows into `user_role` so the new resolvers (Phase 2) can read from one place.
 *
 * The permission catalog + `role_permission` bindings are deliberately deferred
 * to Phase 3 (CASL adoption) because Phase 1's only consumer is the role-name
 * projection in `RbacService` — no policy reads `(action, subject)` yet.
 *
 * Idempotent on roles (`ON CONFLICT (name) DO NOTHING`). The `user_role` insert
 * filters duplicates via `NOT EXISTS` against the canonical `(user_id, role_id,
 * conditions)` triple, so re-running on a partially-backfilled DB is safe.
 */
export class SeedRbacRolesAndBackfill1779893621589 implements MigrationInterface {
  name = "SeedRbacRolesAndBackfill1779893621589"

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Seed the 11 roles ---------------------------------------------------
    await queryRunner.query(`
      INSERT INTO "role" ("name", "description", "is_system")
      VALUES
        ('org_owner',         'Owner of an organization',           true),
        ('org_admin',         'Administrator of an organization',   true),
        ('org_member',        'Member of an organization',          true),
        ('project_owner',     'Owner of a project',                 true),
        ('project_admin',     'Administrator of a project',         true),
        ('project_member',    'Member of a project',                true),
        ('agent_owner',       'Owner of an agent',                  true),
        ('agent_admin',       'Administrator of an agent',          true),
        ('agent_member',      'Member of an agent',                 true),
        ('campaign_tester',   'Tester on a review campaign',        true),
        ('campaign_reviewer', 'Reviewer on a review campaign',      true)
      ON CONFLICT ("name") DO NOTHING
    `)

    // --- Backfill user_role from organization_membership ---------------------
    // Soft-deleted rows are skipped — Phase 4 may revisit if auditors want them.
    await queryRunner.query(`
      INSERT INTO "user_role" ("user_id", "role_id", "conditions", "created_at", "updated_at")
      SELECT
        om.user_id,
        r.id,
        jsonb_build_object('organizationId', om.organization_id),
        om.created_at,
        om.updated_at
      FROM "organization_membership" om
      JOIN "role" r ON r.name = 'org_' || om.role
      WHERE om.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "user_role" ur
          WHERE ur.user_id = om.user_id
            AND ur.role_id = r.id
            AND ur.conditions = jsonb_build_object('organizationId', om.organization_id)
        )
    `)

    // --- Backfill user_role from project_membership --------------------------
    // organizationId comes from the parent project so policies can filter by org.
    await queryRunner.query(`
      INSERT INTO "user_role" ("user_id", "role_id", "conditions", "created_at", "updated_at")
      SELECT
        pm.user_id,
        r.id,
        jsonb_build_object('organizationId', p.organization_id, 'projectId', pm.project_id),
        pm.created_at,
        pm.updated_at
      FROM "project_membership" pm
      JOIN "project" p ON p.id = pm.project_id
      JOIN "role" r ON r.name = 'project_' || pm.role
      WHERE pm.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "user_role" ur
          WHERE ur.user_id = pm.user_id
            AND ur.role_id = r.id
            AND ur.conditions = jsonb_build_object('organizationId', p.organization_id, 'projectId', pm.project_id)
        )
    `)

    // --- Backfill user_role from agent_membership ----------------------------
    // organizationId and projectId already live on `agent` via the Connect pattern.
    await queryRunner.query(`
      INSERT INTO "user_role" ("user_id", "role_id", "conditions", "created_at", "updated_at")
      SELECT
        am.user_id,
        r.id,
        jsonb_build_object('organizationId', a.organization_id, 'projectId', a.project_id, 'agentId', am.agent_id),
        am.created_at,
        am.updated_at
      FROM "agent_membership" am
      JOIN "agent" a ON a.id = am.agent_id
      JOIN "role" r ON r.name = 'agent_' || am.role
      WHERE am.deleted_at IS NULL
        AND a.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "user_role" ur
          WHERE ur.user_id = am.user_id
            AND ur.role_id = r.id
            AND ur.conditions = jsonb_build_object('organizationId', a.organization_id, 'projectId', a.project_id, 'agentId', am.agent_id)
        )
    `)

    // --- Backfill user_role from review_campaign_membership ------------------
    // Only accepted (non-null accepted_at) rows survive — pending invites moved
    // to the invitation table in migration 1778086394496-invitation-entity-and-backfill.
    await queryRunner.query(`
      INSERT INTO "user_role" ("user_id", "role_id", "conditions", "created_at", "updated_at")
      SELECT
        rcm.user_id,
        r.id,
        jsonb_build_object('organizationId', rcm.organization_id, 'projectId', rcm.project_id, 'campaignId', rcm.campaign_id),
        rcm.created_at,
        rcm.updated_at
      FROM "review_campaign_membership" rcm
      JOIN "role" r ON r.name = 'campaign_' || rcm.role
      WHERE rcm.deleted_at IS NULL
        AND rcm.accepted_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "user_role" ur
          WHERE ur.user_id = rcm.user_id
            AND ur.role_id = r.id
            AND ur.conditions = jsonb_build_object('organizationId', rcm.organization_id, 'projectId', rcm.project_id, 'campaignId', rcm.campaign_id)
        )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove only the grants pointing at our seeded roles. Other roles inserted
    // post-seed by future migrations or app code are preserved.
    await queryRunner.query(`
      DELETE FROM "user_role"
      WHERE role_id IN (
        SELECT id FROM "role" WHERE name IN (
          'org_owner', 'org_admin', 'org_member',
          'project_owner', 'project_admin', 'project_member',
          'agent_owner', 'agent_admin', 'agent_member',
          'campaign_tester', 'campaign_reviewer'
        )
      )
    `)
    await queryRunner.query(`
      DELETE FROM "role"
      WHERE name IN (
        'org_owner', 'org_admin', 'org_member',
        'project_owner', 'project_admin', 'project_member',
        'agent_owner', 'agent_admin', 'agent_member',
        'campaign_tester', 'campaign_reviewer'
      )
    `)
  }
}
