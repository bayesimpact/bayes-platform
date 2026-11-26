import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { Factory } from "fishery"
import type { Project } from "@/domains/projects/project.entity"
import type { CustomModel } from "./custom-model.entity"

/**
 * A model a workspace added, without key. `projectId` is required. The default URL is on
 * TEST-NET-3: a public address that needs no DNS lookup.
 */
export const customModelFactory = Factory.define<CustomModel>(({ params, sequence }) => {
  if (!params.projectId) throw new Error("projectId is required")
  const now = new Date()
  return {
    id: params.id || randomUUID(),
    projectId: params.projectId,
    project: undefined as unknown as Project,
    name: params.name || `Sample model ${sequence}`,
    baseModel: params.baseModel || AgentModel.Gemma4_26B,
    baseUrl: params.baseUrl || "https://203.0.113.10/v1",
    apiKeyEncrypted: params.apiKeyEncrypted ?? null,
    servedModelName: params.servedModelName ?? null,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: null,
  } satisfies CustomModel
})
