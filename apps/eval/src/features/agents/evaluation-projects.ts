import {
  EVALUATION_UI_READ_PERMISSION,
  type MyOrganizationOutputDto,
  type MyProjectOutputDto,
  PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
} from "@caseai-connect/eval-contracts"

/** A project the app opens for the person, with its organization and what they hold on it. */
export type EvaluationProject = Pick<MyProjectOutputDto, "id" | "name" | "permissions"> & {
  organization: MyOrganizationOutputDto
}

/**
 * The permissions that open a project in the app: evaluating its agents, which the
 * `project_evaluator` role grants, or seeing its review campaigns, which its owners and admins do.
 */
const PROJECT_ACCESS_PERMISSIONS: readonly string[] = [
  EVALUATION_UI_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
]

/** Whether the person holds a permission on a project. */
export function hasProjectPermission(project: EvaluationProject, permission: string): boolean {
  return project.permissions.includes(permission)
}

/**
 * The projects the person evaluates or whose review campaigns they manage, with their
 * organization, sorted by organization then project name. A project whose organization the person
 * cannot read is left out, as the onboarding page of apps/web leaves it out.
 */
export function listEvaluationProjects(
  projects: MyProjectOutputDto[],
  organizations: MyOrganizationOutputDto[],
): EvaluationProject[] {
  const organizationsById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  )
  return projects
    .flatMap((project) => {
      const organization = organizationsById.get(project.organizationId)
      const isOpen = project.permissions.some((permission) =>
        PROJECT_ACCESS_PERMISSIONS.includes(permission),
      )
      if (!organization || !isOpen) return []
      return [
        { id: project.id, name: project.name, permissions: project.permissions, organization },
      ]
    })
    .sort(
      (first, second) =>
        first.organization.name.localeCompare(second.organization.name) ||
        first.name.localeCompare(second.name),
    )
}
