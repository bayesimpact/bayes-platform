import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { AgentMessageAttachmentDocument } from "./agent-message-attachment-document.entity"

export const agentMessageAttachmentDocumentFactory = Factory.define<
  AgentMessageAttachmentDocument,
  RequiredScopeTransientParams
>(({ params, transientParams }) => {
  if (!transientParams.organization) {
    throw new Error("organization transient is required")
  }
  if (!transientParams.project) {
    throw new Error("project transient is required")
  }

  const now = new Date()
  const id = params.id || randomUUID()
  return {
    id,
    agentSessionId: params.agentSessionId ?? null,
    fileName: params.fileName || "attachment.pdf",
    mimeType: params.mimeType || "application/pdf",
    size: params.size || 1234,
    storageRelativePath:
      params.storageRelativePath ||
      `${transientParams.organization.id}/${transientParams.project.id}/${id}.pdf`,
    pdfPageCount: params.pdfPageCount ?? null,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: null,
    organizationId: transientParams.organization.id,
    organization: transientParams.organization,
    projectId: transientParams.project.id,
    project: transientParams.project,
  } satisfies AgentMessageAttachmentDocument
})
