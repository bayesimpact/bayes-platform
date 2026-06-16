import { randomUUID } from "node:crypto"
import type { ResourceDto } from "@caseai-connect/api-contracts"
import { Factory } from "fishery"
import type { Repository } from "typeorm"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { ResourceLibrary } from "./resource-library.entity"

type ResourceLibraryTransientParams = RequiredScopeTransientParams

class ResourceLibraryFactory extends Factory<ResourceLibrary, ResourceLibraryTransientParams> {}

export function buildResource(overrides: Partial<ResourceDto> = {}): ResourceDto {
  return {
    id: overrides.id ?? randomUUID(),
    title: overrides.title ?? "Getting Started Guide",
    description: overrides.description ?? "A short introduction to the basics.",
    linkType: overrides.linkType ?? "url",
    url: overrides.linkType === "file" ? undefined : (overrides.url ?? "https://example.com/guide"),
    file: overrides.linkType === "file" ? overrides.file : undefined,
  }
}

export const resourceLibraryFactory = ResourceLibraryFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,

      title: params.title || `Resource Library ${sequence}`,
      resources: params.resources ?? [buildResource()],
      agents: params.agents || [],
    } satisfies ResourceLibrary
  },
)

export async function createResourceLibraryForProject({
  repositories,
  organization,
  project,
  params = {},
}: {
  repositories: { resourceLibraryRepository: Repository<ResourceLibrary> }
  organization: Organization
  project: Project
  params?: { resourceLibrary?: Partial<ResourceLibrary> }
}): Promise<ResourceLibrary> {
  const resourceLibrary = resourceLibraryFactory
    .transient({ organization, project })
    .build(params.resourceLibrary)
  await repositories.resourceLibraryRepository.save(resourceLibrary)
  return resourceLibrary
}
