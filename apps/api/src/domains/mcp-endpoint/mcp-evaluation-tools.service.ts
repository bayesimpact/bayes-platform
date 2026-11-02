import type {
  AgentModel,
  EvaluationConversationRunRecordStatusDto,
  EvaluationConversationRunStatusDto,
  EvaluationConversationRunSummaryDto,
} from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { getAppPublicUrl } from "@/config/app-public-url"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ActivitiesService } from "@/domains/activities/activities.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationDatasetsService } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-datasets.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunsService } from "@/domains/evaluations/conversation/runs/evaluation-conversation-runs.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  AGENT_READ_PERMISSION,
  AGENT_SETTINGS_DRAFT_READ_PERMISSION,
  AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import type { McpCaller, McpResult } from "./mcp-agent-tools.service"

/** A stored version of an agent's settings, as the agents domain returns it. */
type AgentSettings = Awaited<ReturnType<AgentSettingsService["getById"]>>

/** A run as the evaluations domain returns it. */
type EvaluationConversationRun = NonNullable<
  Awaited<ReturnType<EvaluationConversationRunsService["getRun"]>>
>

/** The grantable permission behind the dataset tools (ADR 0028). */
export const MCP_DATASET_PERMISSION = EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION

/** The grantable permission behind the run tools (ADR 0028). */
export const MCP_RUN_PERMISSION = EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION

/** Same answer for a missing project, one outside the grant and one the caller cannot use. */
export const EVALUATION_PROJECT_NOT_FOUND_ERROR =
  "Project not found, or you are not allowed to use its evaluations. Call list_projects to see the projects you can use."

/** Same answer for a missing dataset and one of another project. */
export const DATASET_NOT_FOUND_ERROR =
  "Dataset not found in this project. Call list_evaluation_datasets to see its datasets."

/** Same answer for a missing run and one of another project. */
export const RUN_NOT_FOUND_ERROR =
  "Evaluation run not found in this project. Call list_evaluation_runs to see its runs."

/** Same answer for a missing agent, one of another project and one whose version the caller cannot see. */
export const EVALUATED_AGENT_NOT_FOUND_ERROR =
  "Agent or version not found, or you are not allowed to evaluate it. Call get_agent to see the versions you can use."

export type McpEvaluationDataset = {
  id: string
  name: string
  recordCount: number
}

export type McpEvaluationDatasetRecord = {
  id: string
  input: string
  expectedOutput: string
}

export type McpEvaluationRun = {
  id: string
  status: EvaluationConversationRunStatusDto
  agentId: string
  /** The agent version the run evaluates, pinned when the run was created. */
  agentRevision: number
  /** True while that version is still a draft, which the agent's users do not see. */
  agentRevisionIsDraft: boolean
  datasetId: string
  judgeModel: AgentModel
  judgeInstructions: string | null
  summary: EvaluationConversationRunSummaryDto | null
  createdAt: string
  evalUrl: string | null
}

export type McpEvaluationRunRecord = {
  id: string
  status: EvaluationConversationRunRecordStatusDto
  input: string
  expectedOutput: string
  output: string | null
  score: number | null
  errorDetails: string | null
}

export type McpPage<Item> = { items: Item[]; total: number; page: number; limit: number }

/** The agent version a run evaluates: a revision number, the draft, or the latest published one. */
export type McpAgentRevisionChoice = number | "draft" | undefined

/**
 * What the platform MCP endpoint does with conversation evaluations on behalf of a person. The
 * checks are the ones the HTTP routes run on the project, restricted to the projects and
 * permissions of the grant. One grantable permission covers a family of tools: the dataset one
 * lets the client read, create and fill datasets, the run one lets it start runs and read their
 * results, while the person must hold each RBAC permission the tool uses.
 */
@Injectable()
export class McpEvaluationToolsService {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly projectRepository: ProjectRepository,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly datasetsService: EvaluationConversationDatasetsService,
    private readonly runsService: EvaluationConversationRunsService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async listDatasets(
    caller: McpCaller,
    projectId: string,
  ): Promise<McpResult<McpEvaluationDataset[]>> {
    const connectScope = await this.resolveScope(caller, projectId, MCP_DATASET_PERMISSION, [
      EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
    ])
    if (!connectScope) return { ok: false, error: EVALUATION_PROJECT_NOT_FOUND_ERROR }

    const [datasets, recordCounts] = await Promise.all([
      this.datasetsService.listDatasets({ connectScope }),
      this.datasetsService.countRecordsByDatasetId({ connectScope }),
    ])
    return {
      ok: true,
      value: datasets.map((dataset) => ({
        id: dataset.id,
        name: dataset.name,
        recordCount: recordCounts[dataset.id] ?? 0,
      })),
    }
  }

  async createDataset(
    caller: McpCaller,
    input: { projectId: string; name: string },
  ): Promise<McpResult<McpEvaluationDataset>> {
    const connectScope = await this.resolveScope(caller, input.projectId, MCP_DATASET_PERMISSION, [
      EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
    ])
    if (!connectScope) return { ok: false, error: EVALUATION_PROJECT_NOT_FOUND_ERROR }

    return this.withReadableErrors(async () => {
      const dataset = await this.datasetsService.createDataset({ connectScope, name: input.name })
      await this.trackActivity(caller, connectScope, "evaluationConversationDataset.create")
      return { id: dataset.id, name: dataset.name, recordCount: 0 }
    })
  }

  async addDatasetRecords(
    caller: McpCaller,
    input: {
      projectId: string
      datasetId: string
      records: Array<{ input: string; expectedOutput: string }>
    },
  ): Promise<McpResult<McpEvaluationDataset>> {
    const connectScope = await this.resolveScope(caller, input.projectId, MCP_DATASET_PERMISSION, [
      EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
    ])
    if (!connectScope) return { ok: false, error: EVALUATION_PROJECT_NOT_FOUND_ERROR }
    const dataset = await this.findDataset(connectScope, input.datasetId)
    if (!dataset) return { ok: false, error: DATASET_NOT_FOUND_ERROR }

    return this.withReadableErrors(async () => {
      await this.datasetsService.createRecords({
        connectScope,
        datasetId: dataset.id,
        records: input.records,
      })
      await this.trackActivity(caller, connectScope, "evaluationConversationDataset.createRecords")
      const recordCounts = await this.datasetsService.countRecordsByDatasetId({ connectScope })
      return { id: dataset.id, name: dataset.name, recordCount: recordCounts[dataset.id] ?? 0 }
    })
  }

  async listDatasetRecords(
    caller: McpCaller,
    input: { projectId: string; datasetId: string; page: number; limit: number },
  ): Promise<McpResult<McpPage<McpEvaluationDatasetRecord>>> {
    const connectScope = await this.resolveScope(caller, input.projectId, MCP_DATASET_PERMISSION, [
      EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
    ])
    if (!connectScope) return { ok: false, error: EVALUATION_PROJECT_NOT_FOUND_ERROR }
    if (!(await this.findDataset(connectScope, input.datasetId))) {
      return { ok: false, error: DATASET_NOT_FOUND_ERROR }
    }

    const { records, total } = await this.datasetsService.listDatasetRecordsPaginated({
      connectScope,
      datasetId: input.datasetId,
      page: input.page,
      limit: input.limit,
    })
    return {
      ok: true,
      value: {
        items: records.map((record) => ({
          id: record.id,
          input: record.input,
          expectedOutput: record.expectedOutput,
        })),
        total,
        page: input.page,
        limit: input.limit,
      },
    }
  }

  /**
   * Creates a run and starts it, like the Evaluation workspace's Run button. A run can pin the
   * agent's draft, so a client evaluates its changes before a person publishes them in the studio.
   */
  async runEvaluation(
    caller: McpCaller,
    input: {
      projectId: string
      agentId: string
      datasetId: string
      agentRevision?: McpAgentRevisionChoice
      judgeModel: AgentModel
      judgeInstructions: string | null
    },
  ): Promise<McpResult<McpEvaluationRun>> {
    const connectScope = await this.resolveScope(caller, input.projectId, MCP_RUN_PERMISSION, [
      EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
      EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
    ])
    if (!connectScope) return { ok: false, error: EVALUATION_PROJECT_NOT_FOUND_ERROR }

    const agentSettings = await this.resolveAgentSettings(caller, connectScope, input)
    if (!agentSettings) return { ok: false, error: EVALUATED_AGENT_NOT_FOUND_ERROR }
    if (!(await this.findDataset(connectScope, input.datasetId))) {
      return { ok: false, error: DATASET_NOT_FOUND_ERROR }
    }

    return this.withReadableErrors(async () => {
      await this.agentSettingsService.assertModelAvailable({
        connectScope,
        model: input.judgeModel,
      })
      const run = await this.runsService.createRun({
        connectScope,
        fields: {
          evaluationConversationDatasetId: input.datasetId,
          agentId: input.agentId,
          agentSettingsId: agentSettings.id,
          judgeModel: input.judgeModel,
          judgeInstructions: input.judgeInstructions,
        },
      })
      await this.trackActivity(caller, connectScope, "evaluationConversationRun.create")
      await this.runsService.enqueueExecuteRun({
        evaluationConversationRun: run,
        connectScope,
        recordLimit: null,
      })
      await this.trackActivity(caller, connectScope, "evaluationConversationRun.execute")
      run.agentSettings = agentSettings
      return toMcpRun(run, connectScope)
    })
  }

  async listRuns(
    caller: McpCaller,
    input: { projectId: string; agentId?: string },
  ): Promise<McpResult<McpEvaluationRun[]>> {
    const connectScope = await this.resolveScope(caller, input.projectId, MCP_RUN_PERMISSION, [
      EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
    ])
    if (!connectScope) return { ok: false, error: EVALUATION_PROJECT_NOT_FOUND_ERROR }

    const runs = await this.runsService.listRuns({ connectScope })
    return {
      ok: true,
      value: runs
        .filter((run) => input.agentId === undefined || run.agentId === input.agentId)
        .map((run) => toMcpRun(run, connectScope)),
    }
  }

  async getRun(
    caller: McpCaller,
    input: { projectId: string; runId: string },
  ): Promise<McpResult<McpEvaluationRun>> {
    const connectScope = await this.resolveScope(caller, input.projectId, MCP_RUN_PERMISSION, [
      EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
    ])
    if (!connectScope) return { ok: false, error: EVALUATION_PROJECT_NOT_FOUND_ERROR }

    const run = await this.findRun(connectScope, input.runId)
    if (!run) return { ok: false, error: RUN_NOT_FOUND_ERROR }
    return { ok: true, value: toMcpRun(run, connectScope) }
  }

  async listRunRecords(
    caller: McpCaller,
    input: { projectId: string; runId: string; page: number; limit: number },
  ): Promise<McpResult<McpPage<McpEvaluationRunRecord>>> {
    const connectScope = await this.resolveScope(caller, input.projectId, MCP_RUN_PERMISSION, [
      EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
    ])
    if (!connectScope) return { ok: false, error: EVALUATION_PROJECT_NOT_FOUND_ERROR }
    if (!(await this.findRun(connectScope, input.runId))) {
      return { ok: false, error: RUN_NOT_FOUND_ERROR }
    }

    const { records, total } = await this.runsService.getRunRecordsPaginated({
      connectScope,
      runId: input.runId,
      page: input.page,
      limit: input.limit,
    })
    return {
      ok: true,
      value: {
        items: records.map((record) => ({
          id: record.id,
          status: record.status,
          input: record.input,
          expectedOutput: record.expectedOutput,
          output: record.output,
          score: record.score,
          errorDetails: record.errorDetails,
        })),
        total,
        page: input.page,
        limit: input.limit,
      },
    }
  }

  /**
   * The project's scope when the client was granted `grantedPermission` on it and the person
   * holds every permission the tool uses there now, or null.
   */
  private async resolveScope(
    caller: McpCaller,
    projectId: string,
    grantedPermission: string,
    heldPermissions: string[],
  ): Promise<RequiredConnectScope | null> {
    if (!caller.projectIds.includes(projectId)) return null
    if (!caller.permissions.includes(grantedPermission)) return null
    for (const permission of heldPermissions) {
      const held = await this.permissionService.has(caller.userId, permission, {
        type: "project",
        id: projectId,
      })
      if (!held) return null
    }
    const [project] = await this.projectRepository.findPickerProjectsByIds([projectId])
    return project ? { organizationId: project.organizationId, projectId } : null
  }

  /**
   * The settings the run pins: a given revision, the draft, or the latest published one. The
   * person must see the agent, and its draft when the revision is one.
   */
  private async resolveAgentSettings(
    caller: McpCaller,
    connectScope: RequiredConnectScope,
    input: { agentId: string; agentRevision?: McpAgentRevisionChoice },
  ): Promise<AgentSettings | null> {
    const agent = { type: "agent" as const, id: input.agentId }
    if (!(await this.permissionService.has(caller.userId, AGENT_READ_PERMISSION, agent))) {
      return null
    }
    const { agentId, agentRevision } = input
    const settings =
      agentRevision === undefined
        ? await this.agentSettingsService.findLastPublished({ connectScope, agentId })
        : agentRevision === "draft"
          ? await this.findDraft(connectScope, agentId)
          : await this.agentSettingsService.get({ connectScope, agentId, revision: agentRevision })
    if (!settings || settings.isArchived) return null
    if (!settings.isDraft) return settings
    const seesDraft =
      (await this.permissionService.has(
        caller.userId,
        AGENT_SETTINGS_DRAFT_READ_PERMISSION,
        agent,
      )) ||
      (await this.permissionService.has(
        caller.userId,
        AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION,
        agent,
      ))
    return seesDraft ? settings : null
  }

  private async findDraft(
    connectScope: RequiredConnectScope,
    agentId: string,
  ): Promise<AgentSettings | undefined> {
    const all = await this.agentSettingsService.getAll({
      connectScope,
      agentId,
      includesDraft: true,
    })
    return all.find((settings) => settings.isDraft)
  }

  private async findDataset(connectScope: RequiredConnectScope, datasetId: string) {
    try {
      return await this.runsService.getDataset({ id: datasetId, connectScope })
    } catch (error) {
      if (error instanceof NotFoundException) return null
      throw error
    }
  }

  /** The run with the agent version it pinned, which its answer shows. */
  private async findRun(
    connectScope: RequiredConnectScope,
    runId: string,
  ): Promise<EvaluationConversationRun | null> {
    const run = await this.runsService.getRun({ connectScope, runId })
    if (!run) return null
    run.agentSettings = await this.agentSettingsService.getById({
      connectScope,
      agentSettingsId: run.agentSettingsId,
    })
    return run
  }

  private async trackActivity(
    caller: McpCaller,
    connectScope: RequiredConnectScope,
    action: string,
  ): Promise<void> {
    await this.activitiesService.createActivity({
      action,
      userId: caller.userId,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      entityId: null,
      entityType: null,
    })
  }

  /** Business rules come back as HTTP exceptions with a readable message. */
  private async withReadableErrors<Value>(work: () => Promise<Value>): Promise<McpResult<Value>> {
    try {
      return { ok: true, value: await work() }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

function toMcpRun(
  run: EvaluationConversationRun,
  connectScope: RequiredConnectScope,
): McpEvaluationRun {
  return {
    id: run.id,
    status: run.status,
    agentId: run.agentId,
    agentRevision: run.agentSettings.revision,
    agentRevisionIsDraft: run.agentSettings.isDraft,
    datasetId: run.evaluationConversationDatasetId,
    judgeModel: run.judgeModel,
    judgeInstructions: run.judgeInstructions,
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    evalUrl: buildEvalRunUrl({
      ...connectScope,
      datasetId: run.evaluationConversationDatasetId,
      runId: run.id,
    }),
  }
}

function buildEvalRunUrl({
  organizationId,
  projectId,
  datasetId,
  runId,
}: {
  organizationId: string
  projectId: string
  datasetId: string
  runId: string
}): string | null {
  const appPublicUrl = getAppPublicUrl()
  if (!appPublicUrl) return null
  return `${appPublicUrl}/eval/o/${organizationId}/p/${projectId}/conversation/${datasetId}/runs/${runId}`
}
