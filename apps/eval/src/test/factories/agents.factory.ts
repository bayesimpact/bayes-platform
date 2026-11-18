import {
  type MyProjectOutputDto,
  type ProjectAgentOutputDto,
  projectAgentOutputSchema,
} from "@caseai-connect/eval-contracts"

/** An agent of `GET .../projects/:projectId/agents-with-drafts`, checked against the contract. */
export function buildProjectAgent(
  project: MyProjectOutputDto,
  overrides: Partial<ProjectAgentOutputDto> = {},
): ProjectAgentOutputDto {
  return projectAgentOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Helpful Assistant",
    type: "conversation",
    projectId: project.id,
    // Published once, as a review campaign needs.
    currentRevision: {},
    ...overrides,
  })
}
