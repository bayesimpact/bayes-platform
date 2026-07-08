import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { documentFactory } from "@/domains/documents/document.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { AgentCsvExtractionRunStatus } from "../agent-csv-extraction-run.entity"
import { agentCsvExtractionRunFactory } from "../agent-csv-extraction-run.factory"

/**
 * Creates an organization, project (with a membership at the given role), an
 * extraction agent and a CSV source document. These are the resources every
 * CSV-extraction-run endpoint needs in scope before it can be reached.
 */
export async function createCsvExtractionRunContext({
  repositories,
  role = "owner",
  auth0Id,
}: {
  repositories: AllRepositories
  role?: ProjectMembershipRoleDto
  auth0Id: string
}) {
  const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
    repositories,
    {
      user: { auth0Id },
      projectMembership: { role },
      agent: { type: "extraction" },
    },
  )

  const csvDocument = documentFactory.transient({ organization, project }).build({
    mimeType: "text/csv",
    fileName: "input.csv",
    storageRelativePath: "documents/input.csv",
  })
  await repositories.documentRepository.save(csvDocument)

  return { user, organization, project, agent, agentSettings, csvDocument }
}

/** Creates and persists a run (defaulting to "pending") in the given scope. */
export async function createCsvExtractionRun({
  repositories,
  context,
  status = "pending",
}: {
  repositories: AllRepositories
  context: Awaited<ReturnType<typeof createCsvExtractionRunContext>>
  status?: AgentCsvExtractionRunStatus
}) {
  const run = agentCsvExtractionRunFactory
    .transient({
      organization: context.organization,
      project: context.project,
      agent: context.agent,
      agentSettings: context.agentSettings,
      csvDocument: context.csvDocument,
    })
    .build({ status })
  await repositories.agentCsvExtractionRunRepository.save(run)
  return run
}
