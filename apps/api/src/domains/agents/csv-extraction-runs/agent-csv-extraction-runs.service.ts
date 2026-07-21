import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { toAgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.helper"
import type { AgentCsvExtractionRunColumnSchema } from "./agent-csv-extraction-run.entity"
import { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import {
  AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE,
  type AgentCsvExtractionRunBatchService,
} from "./agent-csv-extraction-run-batch.interface"
import { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"

const BATCH_SIZE = 500

@Injectable()
export class AgentCsvExtractionRunsService {
  private readonly runConnectRepository: ConnectRepository<AgentCsvExtractionRun>
  private readonly runRecordConnectRepository: ConnectRepository<AgentCsvExtractionRunRecord>

  constructor(
    @InjectRepository(AgentCsvExtractionRun)
    runRepository: Repository<AgentCsvExtractionRun>,
    @InjectRepository(AgentCsvExtractionRunRecord)
    runRecordRepository: Repository<AgentCsvExtractionRunRecord>,
    @Inject(AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE)
    private readonly batchService: AgentCsvExtractionRunBatchService,
  ) {
    this.runConnectRepository = new ConnectRepository(runRepository, "agentCsvExtractionRun")
    this.runRecordConnectRepository = new ConnectRepository(
      runRecordRepository,
      "agentCsvExtractionRunRecord",
    )
  }

  async createRun({
    connectScope,
    fields,
  }: {
    connectScope: RequiredConnectScope
    fields: {
      agentId: string
      agentSettingsId: string
      csvDocumentId: string
      columnSchema: AgentCsvExtractionRunColumnSchema
    }
  }): Promise<AgentCsvExtractionRun> {
    return this.runConnectRepository.createAndSave(connectScope, {
      agentSettingsId: fields.agentSettingsId,
      csvDocumentId: fields.csvDocumentId,
      columnSchema: fields.columnSchema,
      status: "pending",
      summary: null,
      csvExportDocumentId: null,
    })
  }

  async getRun({
    connectScope,
    runId,
  }: {
    connectScope: RequiredConnectScope
    runId: string
  }): Promise<AgentCsvExtractionRun | null> {
    return this.runConnectRepository.getOneById(connectScope, runId)
  }

  async listRuns({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentCsvExtractionRun[]> {
    const runs = await this.runConnectRepository.find(connectScope, {
      where: { agentSettings: { agentId } },
      relations: { agentSettings: true },
      order: { createdAt: "DESC" },
    })
    return runs
  }

  async markRunCancelled({
    agentCsvExtractionRun,
    connectScope,
  }: {
    connectScope: RequiredConnectScope
    agentCsvExtractionRun: AgentCsvExtractionRun
  }): Promise<AgentCsvExtractionRun> {
    if (
      // Only allow cancelling runs that are currently pending or running. Completed, failed or cancelled runs cannot be cancelled (again)
      ["pending", "running"].indexOf(agentCsvExtractionRun.status) === -1
    ) {
      throw new UnprocessableEntityException(
        `Cannot cancel a run with status "${agentCsvExtractionRun.status}"`,
      )
    }
    agentCsvExtractionRun.status = "cancelled"

    await this.runRecordConnectRepository.updateManyBy({
      connectScope,
      where: { agentCsvExtractionRunId: agentCsvExtractionRun.id, status: "running" },
      fields: { status: "cancelled" },
    })

    return this.runConnectRepository.saveOne(agentCsvExtractionRun)
  }

  async enqueueExecuteRun({
    agentCsvExtractionRun,
    connectScope,
    recordLimit,
  }: {
    agentCsvExtractionRun: AgentCsvExtractionRun
    connectScope: RequiredConnectScope
    recordLimit?: number | null
  }): Promise<void> {
    await this.batchService.enqueueExecuteRun({
      agentCsvExtractionRunId: agentCsvExtractionRun.id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      recordLimit: recordLimit ?? null,
    })
  }

  async retryRun({
    agentCsvExtractionRun,
    connectScope,
    agent,
    agentSettings,
  }: {
    agentCsvExtractionRun: AgentCsvExtractionRun
    connectScope: RequiredConnectScope
    agent: import("@/domains/agents/agent.entity").Agent
    agentSettings: import("@/domains/agents/settings/agent-settings.entity").AgentSettings
  }): Promise<void> {
    agentCsvExtractionRun.status = "running"
    await this.runConnectRepository.saveOne(agentCsvExtractionRun)

    const unfinishedRecords = await this.runRecordConnectRepository.find(connectScope, {
      where: [
        { agentCsvExtractionRunId: agentCsvExtractionRun.id, status: "running" },
        { agentCsvExtractionRunId: agentCsvExtractionRun.id, status: "error" },
        { agentCsvExtractionRunId: agentCsvExtractionRun.id, status: "cancelled" },
      ],
    })

    const batches = batchArray(unfinishedRecords, BATCH_SIZE)

    try {
      await Promise.all(
        batches.map(
          async (batch) =>
            await this.batchService.retryRunRecords(
              batch.map((runRecord) => ({
                agentCsvExtractionRun,
                runRecordId: runRecord.id,
                connectScope,
                columnSchema: agentCsvExtractionRun.columnSchema,
                agentWithSettings: toAgentWithSettingsRunJobPayload({
                  agent,
                  agentSettings,
                }),
              })),
            ),
        ),
      )
    } catch (error) {
      agentCsvExtractionRun.status = "failed"
      await this.runConnectRepository.saveOne(agentCsvExtractionRun)
      throw new UnprocessableEntityException(
        `Failed to retry jobs for run ${agentCsvExtractionRun.id}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }
  }

  async getRunRecordsPaginated({
    connectScope,
    runId,
    page,
    limit,
    sortBy,
    sortOrder,
  }: {
    connectScope: RequiredConnectScope
    runId: string
    page: number
    limit: number
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }): Promise<{ records: AgentCsvExtractionRunRecord[]; total: number }> {
    const alias = "agentCsvExtractionRunRecord"
    const safeKeyPattern = /^[\w-]{1,64}$/

    const query = this.runRecordConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .andWhere(`${alias}.agentCsvExtractionRunId = :runId`, { runId })

    const sortAlias = "__sort_val"
    if (sortBy) {
      const direction = sortOrder === "asc" ? "ASC" : "DESC"
      if (sortBy === "status") {
        query.orderBy(`${alias}.status`, direction)
      } else if (sortBy === "errorDetails") {
        query.orderBy(`${alias}.errorDetails`, direction)
      } else if (sortBy === "rowIndex") {
        query.orderBy(`${alias}.rowIndex`, direction)
      } else if (sortBy.startsWith("input_") && safeKeyPattern.test(sortBy.slice(6))) {
        const dataKey = sortBy.slice(6)
        query.addSelect(`${alias}.input_data ->> '${dataKey}'`, sortAlias)
        query.orderBy(sortAlias, direction)
      } else if (sortBy.startsWith("agent_") && safeKeyPattern.test(sortBy.slice(6))) {
        const agentKey = sortBy.slice(6)
        query.addSelect(`${alias}.agent_raw_output ->> '${agentKey}'`, sortAlias)
        query.orderBy(sortAlias, direction)
      } else {
        query.orderBy(`${alias}.rowIndex`, "ASC")
      }
    } else {
      query.orderBy(`${alias}.rowIndex`, "ASC")
    }

    query.skip(page * limit).take(limit)

    const [records, total] = await query.getManyAndCount()

    return { records, total }
  }

  async removePendingJobsForRun({
    agentCsvExtractionRunId,
    connectScope,
  }: {
    agentCsvExtractionRunId: string
    connectScope: RequiredConnectScope
  }): Promise<void> {
    const unfinishedRecords = await this.runRecordConnectRepository.find(connectScope, {
      where: { agentCsvExtractionRunId, status: "running" },
    })

    const batches = batchArray(unfinishedRecords, BATCH_SIZE)

    try {
      await Promise.all(
        batches.map(
          async (batch) =>
            await this.batchService.removePendingRunRecords(batch.map((runRecord) => runRecord.id)),
        ),
      )
    } catch (error) {
      throw new UnprocessableEntityException(
        `Failed to remove pending jobs for run ${agentCsvExtractionRunId}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }
  }

  async deleteRun({
    connectScope,
    agentCsvExtractionRunId,
  }: {
    connectScope: RequiredConnectScope
    agentCsvExtractionRunId: string
  }): Promise<void> {
    try {
      await this.removePendingJobsForRun({ connectScope, agentCsvExtractionRunId })
    } catch {
      // Best-effort: proceed with delete even if job cleanup fails
    }

    await this.runRecordConnectRepository.deleteManyBy({
      connectScope,
      where: { agentCsvExtractionRunId },
      softDelete: false,
    })

    const isDeleted = await this.runConnectRepository.deleteOneById({
      connectScope,
      id: agentCsvExtractionRunId,
      softDelete: false,
    })

    if (!isDeleted) {
      throw new NotFoundException(
        `Agent CSV extraction run with id ${agentCsvExtractionRunId} not found`,
      )
    }
  }
}

function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize))
  }
  return batches
}
