import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { Factory } from "fishery"
import type { Project } from "@/domains/projects/project.entity"
import type { ProjectModel } from "./project-model.entity"

/** A model of the code turned on in a workspace. `projectId` is required. */
export const projectModelFactory = Factory.define<ProjectModel>(({ params }) => {
  if (!params.projectId) throw new Error("projectId is required")
  const now = new Date()
  return {
    id: params.id || randomUUID(),
    projectId: params.projectId,
    project: undefined as unknown as Project,
    model: params.model || AgentModel.Gemma4_26B,
    enabled: params.enabled ?? true,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: null,
  } satisfies ProjectModel
})
