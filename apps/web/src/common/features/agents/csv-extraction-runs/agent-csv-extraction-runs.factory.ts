import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "../agents.models"
import type {
  AgentCsvExtractionRun,
  AgentCsvExtractionRunRecord,
} from "./agent-csv-extraction-runs.models"

type AgentCsvExtractionRunTransientParams = {
  agent: Agent
}

class AgentCsvExtractionRunFactory extends Factory<
  AgentCsvExtractionRun,
  AgentCsvExtractionRunTransientParams
> {}

export const agentCsvExtractionRunFactory = AgentCsvExtractionRunFactory.define(
  ({ params, transientParams }) => {
    const { agent } = transientParams
    if (!agent) {
      throw new Error(
        "Agent must be provided in transient params to build an AgentCsvExtractionRun",
      )
    }

    // Default schema: two input columns the agent reads, and one ignored column.
    const columnSchema = (params.columnSchema as AgentCsvExtractionRun["columnSchema"]) ?? {
      title: { id: "title", originalName: "Title", finalName: "title", role: "input", index: 0 },
      summary: {
        id: "summary",
        originalName: "Summary",
        finalName: "summary",
        role: "input",
        index: 1,
      },
      notes: { id: "notes", originalName: "Notes", finalName: "notes", role: "ignore", index: 2 },
    }

    return {
      id: params.id ?? faker.string.uuid(),
      agentId: agent.id,
      agentSettingsId: params.agentSettingsId ?? faker.string.uuid(),
      agentRevision: params.agentRevision ?? 1,
      csvDocumentId: params.csvDocumentId ?? faker.string.uuid(),
      columnSchema,
      type: params.type ?? "playground",
      status: params.status ?? "completed",
      summary:
        params.summary === null
          ? null
          : {
              total: params.summary?.total ?? 3,
              processed: params.summary?.processed ?? 3,
              errors: params.summary?.errors ?? 0,
              running: params.summary?.running ?? 0,
            },
      csvExportDocumentId: params.csvExportDocumentId ?? null,
      projectId: agent.projectId,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)

type AgentCsvExtractionRunRecordTransientParams = {
  run: AgentCsvExtractionRun
}

class AgentCsvExtractionRunRecordFactory extends Factory<
  AgentCsvExtractionRunRecord,
  AgentCsvExtractionRunRecordTransientParams
> {}

export const agentCsvExtractionRunRecordFactory = AgentCsvExtractionRunRecordFactory.define(
  ({ params, transientParams, sequence }) => {
    const { run } = transientParams
    if (!run) {
      throw new Error(
        "Run must be provided in transient params to build an AgentCsvExtractionRunRecord",
      )
    }

    const inputData =
      params.inputData === null
        ? null
        : ((params.inputData as Record<string, unknown> | undefined) ??
          Object.fromEntries(
            Object.values(run.columnSchema)
              .filter((column) => column.role === "input")
              .map((column) => [column.id, faker.lorem.sentence()]),
          ))

    return {
      id: params.id ?? faker.string.uuid(),
      agentCsvExtractionRunId: run.id,
      rowIndex: params.rowIndex ?? sequence - 1,
      status: params.status ?? "success",
      inputData,
      agentRawOutput:
        params.agentRawOutput === null
          ? null
          : ((params.agentRawOutput as Record<string, unknown> | undefined) ?? {
              category: faker.helpers.arrayElement(["Product", "Pricing", "Support"]),
              summary: faker.lorem.sentence(),
            }),
      errorDetails: params.errorDetails ?? null,
      traceUrl: params.traceUrl ?? null,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)
