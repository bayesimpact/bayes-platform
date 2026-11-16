import {
  EVALUATION_UI_READ_PERMISSION,
  type MyOrganizationOutputDto,
  type MyProjectOutputDto,
} from "@caseai-connect/eval-contracts"

/** A project whose agents the person can evaluate, with its organization. */
export type EvaluationProject = Pick<MyProjectOutputDto, "id" | "name"> & {
  organization: MyOrganizationOutputDto
}

/**
 * The projects where the person holds `evaluation.ui.read`, which the `project_evaluator` role
 * grants, with their organization, sorted by organization then project name. A project whose
 * organization the person cannot read is left out, as the onboarding page of apps/web leaves it out.
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
      if (!organization || !project.permissions.includes(EVALUATION_UI_READ_PERMISSION)) return []
      return [{ id: project.id, name: project.name, organization }]
    })
    .sort(
      (first, second) =>
        first.organization.name.localeCompare(second.organization.name) ||
        first.name.localeCompare(second.name),
    )
}
