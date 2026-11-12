import {
  AGENT_SESSION_CREATE_PERMISSIONS,
  type MyProjectOutputDto,
  type ProjectAgentOutputDto,
  projectAgentOutputSchema,
} from "@caseai-connect/desk-contracts"

/**
 * An agent of `GET .../projects/:projectId/agents`, checked against the contract, which the person
 * may open a session with unless `permissions` says otherwise.
 */
export function buildProjectAgent(
  project: MyProjectOutputDto,
  overrides: Partial<ProjectAgentOutputDto> = {},
): ProjectAgentOutputDto {
  const type = overrides.type ?? "conversation"
  return projectAgentOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Helpful Assistant",
    type,
    projectId: project.id,
    currentRevision: {},
    permissions: [AGENT_SESSION_CREATE_PERMISSIONS[type]],
    ...overrides,
  })
}
