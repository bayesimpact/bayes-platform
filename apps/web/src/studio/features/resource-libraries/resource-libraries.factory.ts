import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { Resource, ResourceLibrary } from "./resource-libraries.models"

type ResourceLibraryTransientParams = {
  project: Project
}

export function buildResource(overrides: Partial<Resource> = {}): Resource {
  const linkType = overrides.linkType ?? "url"
  return {
    id: overrides.id ?? faker.string.uuid(),
    title: overrides.title ?? faker.commerce.productName(),
    description: overrides.description ?? faker.lorem.sentence(),
    linkType,
    url: linkType === "file" ? undefined : (overrides.url ?? faker.internet.url()),
    file:
      linkType === "file"
        ? (overrides.file ?? {
            storageRelativePath: faker.system.filePath(),
            fileName: faker.system.commonFileName("pdf"),
            mimeType: "application/pdf",
          })
        : undefined,
  }
}

const LIBRARY_TITLES = ["Getting Started", "Guides", "Templates", "FAQ", "Onboarding"]

class ResourceLibraryFactory extends Factory<ResourceLibrary, ResourceLibraryTransientParams> {}

export const resourceLibraryFactory = ResourceLibraryFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error("Project must be provided in transient params to build a ResourceLibrary")
    }

    return {
      id: params.id ?? faker.string.uuid(),
      title: params.title ?? faker.helpers.arrayElement(LIBRARY_TITLES),
      resources: params.resources ?? [buildResource()],
      organizationId: project.organizationId,
      projectId: project.id,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)
