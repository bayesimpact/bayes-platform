import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { DocumentTag } from "./document-tags.models"

type DocumentTagTransientParams = {
  project: Project
  parent?: DocumentTag
}

const TAG_NAMES = ["Product", "Pricing", "Support", "Onboarding", "Billing", "Legal"]

class DocumentTagFactory extends Factory<DocumentTag, DocumentTagTransientParams> {}

export const documentTagFactory = DocumentTagFactory.define(({ params, transientParams }) => {
  const { project, parent } = transientParams
  if (!project) {
    throw new Error("Project must be provided in transient params to build a DocumentTag")
  }

  return {
    id: params.id ?? faker.string.uuid(),
    name: params.name ?? faker.helpers.arrayElement(TAG_NAMES),
    description: params.description,
    organizationId: project.organizationId,
    projectId: project.id,
    parentId: params.parentId ?? parent?.id,
    childrenIds: params.childrenIds ?? [],
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
  }
})
