import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import type { BaseAgentSessionType } from "@/domains/agents/base-agent-sessions/base-agent-sessions.types"
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
  authSubject,
}: {
  repositories: AllRepositories
  role?: ProjectMembershipRoleDto
  authSubject: string
}) {
  const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
    repositories,
    {
      user: { authSubject },
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

/**
 * Creates and persists a run (defaulting to "pending" and "live") in the given scope, owned by
 * the context user unless another `user` is given (`null` = a legacy row from before ownership
 * was tracked).
 */
export async function createCsvExtractionRun({
  repositories,
  context,
  status = "pending",
  type = "live",
  user = context.user,
}: {
  repositories: AllRepositories
  context: Awaited<ReturnType<typeof createCsvExtractionRunContext>>
  status?: AgentCsvExtractionRunStatus
  type?: BaseAgentSessionType
  user?: Awaited<ReturnType<typeof createCsvExtractionRunContext>>["user"] | null
}) {
  const run = agentCsvExtractionRunFactory
    .transient({
      organization: context.organization,
      project: context.project,
      agent: context.agent,
      agentSettings: context.agentSettings,
      csvDocument: context.csvDocument,
      user: user ?? undefined,
    })
    .build({ status, type })
  await repositories.agentCsvExtractionRunRepository.save(run)
  return run
}
