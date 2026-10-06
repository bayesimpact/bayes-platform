import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { agentFactory } from "@/domains/agents/agent.factory"
import type { BaseAgentSessionType } from "@/domains/agents/base-agent-sessions/base-agent-sessions.types"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
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

/** Creates and persists a second extraction agent, with its settings, in the project of `context`. */
export async function createOtherAgentInProject({
  repositories,
  context,
}: {
  repositories: AllRepositories
  context: Awaited<ReturnType<typeof createCsvExtractionRunContext>>
}) {
  const agent = agentFactory
    .transient({ organization: context.organization, project: context.project })
    .build({ type: "extraction" })
  await repositories.agentRepository.save(agent)
  const agentSettings = agentSettingsFactory
    .transient({ organization: context.organization, project: context.project, agent })
    .build()
  await repositories.agentSettingsRepository.save(agentSettings)
  return { agent, agentSettings }
}

/** Creates the results export document of `run` and links it, as the export service does once a run ends. */
export async function attachCsvExtractionRunExport({
  repositories,
  context,
  run,
}: {
  repositories: AllRepositories
  context: Awaited<ReturnType<typeof createCsvExtractionRunContext>>
  run: Awaited<ReturnType<typeof createCsvExtractionRun>>
}) {
  const exportDocument = documentFactory
    .transient({ organization: context.organization, project: context.project })
    .build({
      mimeType: "text/csv",
      fileName: "export.csv",
      storageRelativePath: "documents/export.csv",
    })
  await repositories.documentRepository.save(exportDocument)
  await repositories.agentCsvExtractionRunRepository.update(run.id, {
    csvExportDocumentId: exportDocument.id,
  })
  return exportDocument
}
