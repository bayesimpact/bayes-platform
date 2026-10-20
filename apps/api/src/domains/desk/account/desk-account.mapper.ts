import type { MeOutputDto } from "@caseai-connect/desk-contracts"
import type { EndpointRequest } from "@/common/context/request.interface"
import type { OrganizationModel } from "@/domains/organizations/organization.model"
import type { ProjectModel } from "@/domains/projects/project.model"

/**
 * The caller and their projects, sorted by organization then project name. A project whose
 * organization the caller cannot read is left out, as the onboarding page of apps/web leaves it out.
 */
/** The signed-in person, as the user guard puts it on the request. */
export type DeskUser = Pick<EndpointRequest["user"], "id" | "name" | "email">

export function toMeOutputDto({
  user,
  projects,
  organizations,
}: {
  user: DeskUser
  projects: ProjectModel[]
  organizations: OrganizationModel[]
}): MeOutputDto {
  const organizationsById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  )
  return {
    user: { id: user.id, name: user.name, email: user.email },
    projects: projects
      .flatMap((project) => {
        const organization = organizationsById.get(project.organizationId)
        if (!organization) return []
        return [
          {
            id: project.id,
            name: project.name,
            organization: { id: organization.id, name: organization.name },
          },
        ]
      })
      .sort(
        (first, second) =>
          first.organization.name.localeCompare(second.organization.name) ||
          first.name.localeCompare(second.name),
      ),
  }
}
