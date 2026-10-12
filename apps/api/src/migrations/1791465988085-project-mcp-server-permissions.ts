import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * MCP servers move to RBAC, with the same people the legacy policy let in:
 * `project.mcp_server.read` on every project role, and `.create`, `.update` and `.delete`
 * on project owner/admin only. No schema change, role_permission rows only.
 */
export class ProjectMcpServerPermissions1791465988085 implements MigrationInterface {
  name = "ProjectMcpServerPermissions1791465988085"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'project.mcp_server.read'
      FROM "role" AS role
      WHERE role.key IN ('project_owner', 'project_admin', 'project_member')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('project.mcp_server.create'),
          ('project.mcp_server.update'),
          ('project.mcp_server.delete')
      ) AS permission(key)
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin', 'project_member')
        AND role_permission.permission_key IN (
          'project.mcp_server.read',
          'project.mcp_server.create',
          'project.mcp_server.update',
          'project.mcp_server.delete'
        )
    `)
  }
}
