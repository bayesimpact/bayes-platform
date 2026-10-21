import {
  DESK_UI_READ_PERMISSION,
  type MyOrganizationOutputDto,
  type MyProjectOutputDto,
} from "@caseai-connect/desk-contracts"

/** A project the person can open in the Desk, with its organization. */
export type DeskProject = Pick<MyProjectOutputDto, "id" | "name" | "featureFlags"> & {
  organization: MyOrganizationOutputDto
}

/**
 * The projects where the person holds `desk.ui.read`, with their organization, sorted by
 * organization then project name. A project whose organization the person cannot read is left
 * out, as the onboarding page of apps/web leaves it out.
 */
export function listDeskProjects(
  projects: MyProjectOutputDto[],
  organizations: MyOrganizationOutputDto[],
): DeskProject[] {
  const organizationsById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  )
  return projects
    .flatMap((project) => {
      const organization = organizationsById.get(project.organizationId)
      if (!organization || !project.permissions.includes(DESK_UI_READ_PERMISSION)) return []
      return [
        { id: project.id, name: project.name, featureFlags: project.featureFlags, organization },
      ]
    })
    .sort(
      (first, second) =>
        first.organization.name.localeCompare(second.organization.name) ||
        first.name.localeCompare(second.name),
    )
}
