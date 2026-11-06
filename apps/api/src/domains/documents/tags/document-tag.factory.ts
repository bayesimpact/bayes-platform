import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { DocumentTag } from "./document-tag.entity"

type DocumentTagTransientParams = RequiredScopeTransientParams

class DocumentTagFactory extends Factory<DocumentTag, DocumentTagTransientParams> {}

export const documentTagFactory = DocumentTagFactory.define(
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
      name: params.name || `Test Tag ${sequence}`,
      description: params.description ?? null,
      parentId: params.parentId ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
      documents: params.documents || [],
      documentSources: params.documentSources || [],
      agents: params.agents || [],
    } satisfies DocumentTag
  },
)
