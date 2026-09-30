import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Auth0 → generic OIDC (#148).
 *
 * 1. `user.auth0_id` becomes `user.auth_subject`, the `sub` claim of any OIDC
 *    provider. People added by email who never signed in used a fake
 *    `00000000-0000-0000-0000-…` identifier; they now have a NULL subject.
 *
 * 2. Invitations are gone: access is granted right away. Pending invitations
 *    become the memberships their acceptance would have created, following
 *    the rules of MemberGrantsService at the time of writing (frozen here on
 *    purpose: a migration must not depend on code that keeps changing):
 *    - project: organization admin + project admin + admin of every agent of
 *      the project (an agent owner keeps the owner role);
 *    - agent: organization member + project member + agent member;
 *    - review campaign: organization member + project member + campaign role.
 *    An unknown email gets an account with a NULL subject, linked at the
 *    person's first sign-in. Converted invitations are marked accepted; the
 *    `invitation` table itself is dropped by a later migration.
 *
 * `down()` restores the column. The memberships created in step 2 stay: they
 * cannot be told apart from memberships granted afterwards.
 */
export class GenericOidcUserSubject1790626076979 implements MigrationInterface {
  name = "GenericOidcUserSubject1790626076979"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN "auth0_id" TO "auth_subject"`)
    await queryRunner.query(
      `ALTER TABLE "user" RENAME CONSTRAINT "UQ_5222bec366027bdf8b112120013" TO "UQ_eeebedd500f708b3606b64c2ba6"`,
    )
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "auth_subject" DROP NOT NULL`)
    await queryRunner.query(
      `UPDATE "user" SET "auth_subject" = NULL WHERE "auth_subject" LIKE '00000000-0000-0000-0000-%'`,
    )
    await queryRunner.query(CONVERT_PENDING_INVITATIONS)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "user" SET "auth_subject" = '00000000-0000-0000-0000-' || substr(md5("id"::text), 1, 12) WHERE "auth_subject" IS NULL`,
    )
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "auth_subject" SET NOT NULL`)
    await queryRunner.query(
      `ALTER TABLE "user" RENAME CONSTRAINT "UQ_eeebedd500f708b3606b64c2ba6" TO "UQ_5222bec366027bdf8b112120013"`,
    )
    await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN "auth_subject" TO "auth0_id"`)
  }
}

const CONVERT_PENDING_INVITATIONS = `
DO $$
DECLARE
  pending record;
  target_user_id uuid;
  target_user_type varchar;
  target_organization_id uuid;
  target_project_id uuid;
  project_agent record;
  org_admin_role uuid := (SELECT "id" FROM "role" WHERE "key" = 'org_admin');
  org_member_role uuid := (SELECT "id" FROM "role" WHERE "key" = 'org_member');
  project_admin_role uuid := (SELECT "id" FROM "role" WHERE "key" = 'project_admin');
  project_member_role uuid := (SELECT "id" FROM "role" WHERE "key" = 'project_member');
  agent_admin_role uuid := (SELECT "id" FROM "role" WHERE "key" = 'agent_admin');
  agent_member_role uuid := (SELECT "id" FROM "role" WHERE "key" = 'agent_member');
BEGIN
  IF to_regclass('public.invitation') IS NULL THEN
    RETURN;
  END IF;

  FOR pending IN
    SELECT i."id", i."target_type", i."target_id", i."role",
           lower(trim(coalesce(i."invited_email", u."email"))) AS "email"
    FROM "invitation" i
    LEFT JOIN "user" u ON u."id" = i."user_id"
    WHERE i."status" = 'pending' AND i."deleted_at" IS NULL
    ORDER BY i."invited_at"
  LOOP
    -- Service identities (App installations) never get access by email.
    CONTINUE WHEN pending."email" IS NULL OR pending."email" = ''
      OR pending."email" LIKE '%@service.bayes.internal';

    -- The target must still exist.
    target_organization_id := NULL;
    target_project_id := NULL;
    IF pending."target_type" = 'project' THEN
      SELECT p."organization_id", p."id" INTO target_organization_id, target_project_id
      FROM "project" p WHERE p."id" = pending."target_id" AND p."deleted_at" IS NULL;
    ELSIF pending."target_type" = 'agent' THEN
      SELECT a."organization_id", a."project_id" INTO target_organization_id, target_project_id
      FROM "agent" a WHERE a."id" = pending."target_id" AND a."deleted_at" IS NULL;
    ELSIF pending."target_type" = 'review_campaign' THEN
      SELECT c."organization_id", c."project_id" INTO target_organization_id, target_project_id
      FROM "review_campaign" c WHERE c."id" = pending."target_id" AND c."deleted_at" IS NULL;
    END IF;
    CONTINUE WHEN target_project_id IS NULL;

    -- Find or create the account behind the email.
    target_user_id := NULL;
    SELECT u."id", u."type" INTO target_user_id, target_user_type
    FROM "user" u WHERE u."email" = pending."email" AND u."deleted_at" IS NULL
    ORDER BY u."created_at" LIMIT 1;
    CONTINUE WHEN target_user_type = 'service';
    IF target_user_id IS NULL THEN
      INSERT INTO "user" ("email", "type", "auth_subject")
      VALUES (pending."email", 'human', NULL)
      RETURNING "id" INTO target_user_id;
    END IF;

    IF pending."target_type" = 'project' THEN
      IF NOT EXISTS (
        SELECT 1 FROM "user_membership" m
        WHERE m."user_id" = target_user_id AND m."resource_type" = 'project'
          AND m."resource_id" = target_project_id AND m."deleted_at" IS NULL
      ) THEN
        -- Organization admin (an owner or admin keeps the role).
        UPDATE "user_membership" SET "role" = 'admin', "role_id" = org_admin_role, "updated_at" = now()
        WHERE "user_id" = target_user_id AND "resource_type" = 'organization'
          AND "resource_id" = target_organization_id AND "deleted_at" IS NULL
          AND "role" NOT IN ('admin', 'owner');
        INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
        SELECT target_user_id, 'organization', target_organization_id, 'admin', org_admin_role
        WHERE NOT EXISTS (
          SELECT 1 FROM "user_membership" m
          WHERE m."user_id" = target_user_id AND m."resource_type" = 'organization'
            AND m."resource_id" = target_organization_id AND m."deleted_at" IS NULL
        )
        ON CONFLICT DO NOTHING;

        INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
        VALUES (target_user_id, 'project', target_project_id, 'admin', project_admin_role)
        ON CONFLICT DO NOTHING;

        -- Project admins administer every agent of the project.
        FOR project_agent IN
          SELECT a."id" FROM "agent" a WHERE a."project_id" = target_project_id AND a."deleted_at" IS NULL
        LOOP
          UPDATE "user_membership" SET "role" = 'admin', "role_id" = agent_admin_role, "updated_at" = now()
          WHERE "user_id" = target_user_id AND "resource_type" = 'agent'
            AND "resource_id" = project_agent."id" AND "deleted_at" IS NULL
            AND "role" NOT IN ('admin', 'owner');
          INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
          SELECT target_user_id, 'agent', project_agent."id", 'admin', agent_admin_role
          WHERE NOT EXISTS (
            SELECT 1 FROM "user_membership" m
            WHERE m."user_id" = target_user_id AND m."resource_type" = 'agent'
              AND m."resource_id" = project_agent."id" AND m."deleted_at" IS NULL
          )
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    ELSE
      -- Agent and review campaign: member of the organization and the project.
      INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
      SELECT target_user_id, 'organization', target_organization_id, 'member', org_member_role
      WHERE NOT EXISTS (
        SELECT 1 FROM "user_membership" m
        WHERE m."user_id" = target_user_id AND m."resource_type" = 'organization'
          AND m."resource_id" = target_organization_id AND m."deleted_at" IS NULL
      )
      ON CONFLICT DO NOTHING;
      INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
      SELECT target_user_id, 'project', target_project_id, 'member', project_member_role
      WHERE NOT EXISTS (
        SELECT 1 FROM "user_membership" m
        WHERE m."user_id" = target_user_id AND m."resource_type" = 'project'
          AND m."resource_id" = target_project_id AND m."deleted_at" IS NULL
      )
      ON CONFLICT DO NOTHING;

      IF pending."target_type" = 'agent' THEN
        INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
        SELECT target_user_id, 'agent', pending."target_id", 'member', agent_member_role
        WHERE NOT EXISTS (
          SELECT 1 FROM "user_membership" m
          WHERE m."user_id" = target_user_id AND m."resource_type" = 'agent'
            AND m."resource_id" = pending."target_id" AND m."deleted_at" IS NULL
        )
        ON CONFLICT DO NOTHING;
      ELSIF pending."role" IN ('tester', 'reviewer') THEN
        INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role")
        SELECT target_user_id, 'review_campaign', pending."target_id", pending."role"
        WHERE NOT EXISTS (
          SELECT 1 FROM "user_membership" m
          WHERE m."user_id" = target_user_id AND m."resource_type" = 'review_campaign'
            AND m."resource_id" = pending."target_id" AND m."role" = pending."role"
            AND m."deleted_at" IS NULL
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    UPDATE "invitation"
    SET "status" = 'accepted', "accepted_at" = now(), "user_id" = target_user_id
    WHERE "id" = pending."id";
  END LOOP;
END $$;
`
