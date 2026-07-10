import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AppModule } from "@/app.module"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { toAgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.helper"
import {
  EvaluationExtractionDataset,
  type EvaluationExtractionDatasetSchemaMapping,
} from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionRun } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run.entity"
import type { ProcessEvaluationExtractionRunRecordJobPayload } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run.types"
import {
  EVALUATION_EXTRACTION_RUN_BATCH_SERVICE,
  type EvaluationExtractionRunBatchService,
} from "@/domains/evaluations/extraction/runs/evaluation-extraction-run-batch.interface"
import {
  EvaluationExtractionRunRecord,
  type EvaluationExtractionRunRecordStatus,
} from "@/domains/evaluations/extraction/runs/records/evaluation-extraction-run-record.entity"
import { confirmDatabaseTarget } from "./script-bootstrap"
import {
  type BaseRequeueOptions,
  chunk,
  getOptionalArgValue,
  parseBaseRequeueOptions,
  validateBaseRequeueOptions,
} from "./shared/requeue-helpers"

const REQUEUEABLE_STATUSES: EvaluationExtractionRunRecordStatus[] = [
  "running",
  "error",
  "cancelled",
]

type CliOptions = BaseRequeueOptions & {
  statuses: EvaluationExtractionRunRecordStatus[]
}

export function parseCliOptions(argv: string[]): CliOptions {
  const statusArg = getOptionalArgValue(argv, "--status")
  return {
    ...parseBaseRequeueOptions(argv),
    statuses: statusArg
      ? (statusArg.split(",") as EvaluationExtractionRunRecordStatus[])
      : REQUEUEABLE_STATUSES,
  }
}

const logger = new Logger("RequeueEvaluationExtractionRuns")

function validateCliOptions(options: CliOptions): void {
  validateBaseRequeueOptions(options)

  const validStatuses: EvaluationExtractionRunRecordStatus[] = ["running", "error", "cancelled"]
  for (const status of options.statuses) {
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid --status value "${status}". Valid values: ${validStatuses.join(", ")}`,
      )
    }
  }
}

async function bootstrapCli(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  validateCliOptions(options)
  await confirmDatabaseTarget(logger)

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const agentRepository = app.get<Repository<Agent>>(getRepositoryToken(Agent))
    const agentSettingsRepository = app.get<Repository<AgentSettings>>(
      getRepositoryToken(AgentSettings),
    )
    const runRepository = app.get<Repository<EvaluationExtractionRun>>(
      getRepositoryToken(EvaluationExtractionRun),
    )
    const runRecordRepository = app.get<Repository<EvaluationExtractionRunRecord>>(
      getRepositoryToken(EvaluationExtractionRunRecord),
    )
    const datasetRepository = app.get<Repository<EvaluationExtractionDataset>>(
      getRepositoryToken(EvaluationExtractionDataset),
    )
    const batchService = app.get<EvaluationExtractionRunBatchService>(
      EVALUATION_EXTRACTION_RUN_BATCH_SERVICE,
    )

    const runsToRequeue = await loadRunRecordsForRequeue({ options, runRecordRepository })

    if (runsToRequeue.length === 0) {
      logger.log("No evaluation runs matched the requeue filters.")
      return
    }

    logger.log(`Found ${runsToRequeue.length} runs to ${options.dryRun ? "preview" : "requeue"}.`)

    if (options.dryRun) {
      for (const run of runsToRequeue.slice(0, 20)) {
        logger.log(
          `[dry-run] evaluationExtractionRunId=${run.evaluationExtractionRunId} recordId=${run.id} organizationId=${run.organizationId} projectId=${run.projectId} status=${run.status}`,
        )
      }
      if (runsToRequeue.length > 20) {
        logger.log(`[dry-run] ... ${runsToRequeue.length - 20} additional run(s) omitted`)
      }
      return
    }

    async function getEvaluationExtractionRun(id: string): Promise<EvaluationExtractionRun> {
      const evaluationExtractionRun = await runRepository.findOneBy({ id })
      if (!evaluationExtractionRun) {
        throw logger.warn(`Evaluation extraction run with id=${id} not found.`)
      }
      return evaluationExtractionRun
    }

    async function getAgentWithSettings({
      agentId,
      agentSettingsId,
    }: {
      agentId: string
      agentSettingsId: string
    }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
      const agent = await agentRepository.findOneBy({ id: agentId })
      if (!agent) {
        throw logger.warn(`Agent with id=${agentId} not found.`)
      }
      const agentSettings = await agentSettingsRepository.findOne({
        where: { agentId, id: agentSettingsId },
      })
      if (!agentSettings) throw logger.warn(`AgentSettings for Agent with id=${agentId} not found`)
      return { agent, agentSettings }
    }

    async function getDatasetSchemaMapping(
      id: string,
    ): Promise<EvaluationExtractionDatasetSchemaMapping> {
      const dataset = await datasetRepository.findOneBy({ id })
      if (!dataset) {
        throw logger.warn(`Dataset with id=${id} not found.`)
      }
      return dataset.schemaMapping
    }

    for (const runsBatch of chunk(runsToRequeue, options.batchSize)) {
      const runs = await Promise.all(
        runsBatch.map(async (runRecord) => {
          const connectScope = {
            organizationId: runRecord.organizationId,
            projectId: runRecord.projectId,
          }

          const evaluationExtractionRun = await getEvaluationExtractionRun(
            runRecord.evaluationExtractionRunId,
          )

          const { agent, agentSettings } = await getAgentWithSettings({
            agentId: evaluationExtractionRun.agentId,
            agentSettingsId: evaluationExtractionRun.agentSettingsId,
          })

          const schemaMapping = await getDatasetSchemaMapping(
            evaluationExtractionRun.evaluationExtractionDatasetId,
          )

          return {
            evaluationExtractionRun,
            runRecordId: runRecord.id,
            agentWithSettings: toAgentWithSettingsRunJobPayload({ agent, agentSettings }),
            schemaMapping,
            connectScope,
          } satisfies ProcessEvaluationExtractionRunRecordJobPayload
        }),
      )
      await batchService.enqueueRunRecords(runs)

      logger.log(`Enqueued batch of ${runs.length} run(s) for reprocessing.`)
    }
  } finally {
    await app.close()
  }
}

async function loadRunRecordsForRequeue({
  options,
  runRecordRepository,
}: {
  options: CliOptions
  runRecordRepository: Repository<EvaluationExtractionRunRecord>
}): Promise<EvaluationExtractionRunRecord[]> {
  const queryBuilder = runRecordRepository
    .createQueryBuilder("run")
    .where("run.status IN (:...statuses)", { statuses: options.statuses })
    .andWhere("run.organizationId = :organizationId", {
      organizationId: options.organizationId,
    })
    .andWhere("run.projectId = :projectId", {
      projectId: options.projectId,
    })
    .andWhere("run.deletedAt IS NULL")
    .orderBy("run.createdAt", "ASC")

  if (!options.organizationId || !options.projectId) {
    const error =
      "Cannot load runs for requeue. Both --organizationId and --projectId must be specified."
    throw logger.error(error)
  }

  if (options.limit !== undefined) {
    queryBuilder.limit(options.limit)
  }

  return await queryBuilder.getMany()
}

if (require.main === module) {
  void bootstrapCli()
}
