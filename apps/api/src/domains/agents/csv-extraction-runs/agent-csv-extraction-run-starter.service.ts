import { InjectQueue } from "@nestjs/bullmq"
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Queue } from "bullmq"
import * as Papa from "papaparse"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import {
  AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_RECORD_JOB_NAME,
} from "./agent-csv-extraction-run.constants"
import type { AgentCsvExtractionRunColumnSchema } from "./agent-csv-extraction-run.entity"
import { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import type {
  ExecuteAgentCsvExtractionRunJobPayload,
  ProcessAgentCsvExtractionRunRecordJobPayload,
} from "./agent-csv-extraction-run.types"
import { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"

const BATCH_SIZE = 500

@Injectable()
export class AgentCsvExtractionRunStarterService {
  private readonly logger = new Logger(AgentCsvExtractionRunStarterService.name)
  private readonly runConnectRepository: ConnectRepository<AgentCsvExtractionRun>
  private readonly runRecordConnectRepository: ConnectRepository<AgentCsvExtractionRunRecord>
  private readonly agentConnectRepository: ConnectRepository<Agent>

  constructor(
    @InjectRepository(AgentCsvExtractionRun)
    runRepository: Repository<AgentCsvExtractionRun>,
    @InjectRepository(AgentCsvExtractionRunRecord)
    runRecordRepository: Repository<AgentCsvExtractionRunRecord>,
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    @InjectQueue(AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME)
    private readonly queue: Queue<ProcessAgentCsvExtractionRunRecordJobPayload>,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
  ) {
    this.runConnectRepository = new ConnectRepository(runRepository, "agentCsvExtractionRun")
    this.runRecordConnectRepository = new ConnectRepository(
      runRecordRepository,
      "agentCsvExtractionRunRecord",
    )
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agent")
  }

  async startRun(payload: ExecuteAgentCsvExtractionRunJobPayload): Promise<void> {
    const { agentCsvExtractionRunId, organizationId, projectId, recordLimit } = payload
    const connectScope: RequiredConnectScope = { organizationId, projectId }

    const run = await this.runConnectRepository.getOneById(connectScope, agentCsvExtractionRunId, {
      relations: ["csvDocument"],
    })
    if (!run) {
      throw new NotFoundException(
        `Agent CSV extraction run with id ${agentCsvExtractionRunId} not found`,
      )
    }

    const agent = await this.agentConnectRepository.getOneById(connectScope, run.agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${run.agentId} not found`)
    }

    // Load CSV document from storage
    const csvRows = await this.parseCsvRows({
      storageRelativePath: run.csvDocument?.storageRelativePath,
      runId: run.id,
    })

    const allRows = recordLimit != null ? csvRows.slice(0, recordLimit) : csvRows
    const batches = batchArray(allRows, BATCH_SIZE)
    const runRecords: AgentCsvExtractionRunRecord[] = []

    try {
      await Promise.all(
        batches.map(async (batch, batchIndex) => {
          const batchOffset = batchIndex * BATCH_SIZE
          const batchRunRecords = await this.runRecordConnectRepository.createAndSaveMany({
            connectScope,
            entities: batch.map((csvRow, localIndex) => ({
              agentCsvExtractionRunId: run.id,
              rowIndex: batchOffset + localIndex,
              inputData: buildInputData({ csvRow, columnSchema: run.columnSchema }),
              agentRawOutput: null,
              status: "running" as const,
              errorDetails: null,
              traceId: null,
            })),
            chunkSize: BATCH_SIZE,
          })
          runRecords.push(...batchRunRecords)

          await this.queue.addBulk(
            batchRunRecords.map((runRecord) => ({
              name: AGENT_CSV_EXTRACTION_RUN_RECORD_JOB_NAME,
              data: {
                agentCsvExtractionRun: run,
                runRecordId: runRecord.id,
                connectScope,
                columnSchema: run.columnSchema,
                agent,
              },
              opts: { jobId: runRecord.id },
            })),
          )
        }),
      )
    } catch (error) {
      this.logger.error(
        `Failed to start agent CSV run ${run.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
      run.status = "failed"
      await this.runConnectRepository.saveOne(run)
      throw new UnprocessableEntityException(
        `Failed to start agent CSV run ${run.id}. Error: ${error instanceof Error ? error.message : "No error message"}`,
      )
    }

    run.summary = {
      total: runRecords.length,
      processed: 0,
      errors: 0,
      running: runRecords.length,
    }
    run.status = "running"
    await this.runConnectRepository.saveOne(run)
  }

  private async parseCsvRows({
    storageRelativePath,
    runId,
  }: {
    storageRelativePath: string | undefined
    runId: string
  }): Promise<Record<string, unknown>[]> {
    if (!storageRelativePath) {
      throw new NotFoundException(`CSV document not found for run ${runId}`)
    }
    const buffer = await this.fileStorageService.readFile(storageRelativePath)
    const csvContent = buffer.toString("utf-8")

    const parsed = Papa.parse<Record<string, unknown>>(csvContent, {
      skipEmptyLines: true,
      header: true,
    })

    if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
      throw new UnprocessableEntityException("CSV file has no columns")
    }

    return parsed.data
  }
}

function buildInputData({
  csvRow,
  columnSchema,
}: {
  csvRow: Record<string, unknown>
  columnSchema: AgentCsvExtractionRunColumnSchema
}): Record<string, unknown> {
  const inputData: Record<string, unknown> = {}
  for (const column of Object.values(columnSchema)) {
    inputData[column.id] = csvRow[column.originalName] ?? null
  }
  return inputData
}

function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize))
  }
  return batches
}
