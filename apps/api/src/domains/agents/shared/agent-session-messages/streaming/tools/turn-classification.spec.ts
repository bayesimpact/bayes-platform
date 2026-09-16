import { ToolName } from "@caseai-connect/api-contracts"
import type { LLMMetadata, LLMProvider } from "@/common/interfaces/llm-provider.interface"
import type { RetrievedDocumentChunk } from "@/domains/documents/embeddings/document-chunk.types"
import { createRetrievedChunksRegistry } from "./retrieved-chunks-registry"
import type { ToolExecutionLog } from "./tool-execution-log"
import {
  buildTurnClassificationPrompt,
  buildTurnClassificationSchema,
  resolveSources,
  runTurnClassification,
  type SessionMetadataRecalculator,
} from "./turn-classification"

const chunk = (overrides: Partial<RetrievedDocumentChunk>): RetrievedDocumentChunk => ({
  chunkId: "chunk-1",
  documentId: "doc-1",
  documentTitle: "Employee Handbook",
  documentFileName: "handbook.pdf",
  documentSourceType: "project",
  chunkIndex: 0,
  content: "Employees get 27 days of paid leave.",
  distance: 0.1,
  modelName: "embedding-model",
  isParentChunk: false,
  ...overrides,
})

const metadata: LLMMetadata = {
  traceId: "trace-1",
  agentSessionId: "session-1",
  currentTurn: 1,
  organizationId: "org-1",
  agentId: "agent-1",
  revision: 1,
  projectId: "project-1",
  tags: ["test"],
}

const connectScope = { organizationId: "org-1", projectId: "project-1" }

function fakeProvider(output: unknown | Error) {
  const generateStructuredOutput = jest.fn(
    async (_params: Parameters<LLMProvider["generateStructuredOutput"]>[0]) => {
      if (output instanceof Error) throw output
      return output as Record<string, unknown>
    },
  )
  return {
    provider: { generateStructuredOutput } as unknown as LLMProvider,
    generateStructuredOutput,
  }
}

function fakeRecalculator() {
  const recalculateSessionMetadataFromMessages: jest.MockedFunction<
    SessionMetadataRecalculator["recalculateSessionMetadataFromMessages"]
  > = jest.fn(async ({ selectedCategoryNames, suggestedTitle }) => ({
    suggestedTitle,
    selectedCategoryNames,
  }))
  return { recalculateSessionMetadataFromMessages }
}

const buildConfig = (systemPrompt: string) =>
  ({ model: "mock", temperature: 0, systemPrompt, serviceTier: undefined }) as never

describe("resolveSources", () => {
  it("groups the cited chunks by document, truncates excerpts and reports unknown aliases", () => {
    const registry = createRetrievedChunksRegistry()
    registry.register(chunk({ chunkId: "chunk-1", content: "x".repeat(600) }))
    registry.register(chunk({ chunkId: "chunk-2", documentId: "doc-2", documentTitle: "Other" }))
    registry.register(chunk({ chunkId: "chunk-3" }))

    const { sources, unknownChunkIds } = resolveSources({
      chunkAliases: ["c1", "C3 ", "c1", "c9"],
      retrievedChunksRegistry: registry,
    })

    expect(sources).toHaveLength(1)
    expect(sources[0]?.documentId).toBe("doc-1")
    expect(sources[0]?.chunks.map((citedChunk) => citedChunk.chunkId)).toEqual([
      "chunk-1",
      "chunk-3",
    ])
    expect(sources[0]?.chunks[0]?.partialContent).toHaveLength(501)
    expect(unknownChunkIds).toEqual(["c9"])
  })
})

describe("buildTurnClassificationSchema", () => {
  it("declares only the fields the turn needs, as closed enums", () => {
    const titleOnly = buildTurnClassificationSchema({
      availableCategoryNames: [],
      chunkAliases: [],
    })
    expect(Object.keys(titleOnly.properties as object)).toEqual(["suggestedTitle"])
    expect(titleOnly.required).toEqual(["suggestedTitle"])

    const full = buildTurnClassificationSchema({
      availableCategoryNames: ["HR", "IT"],
      chunkAliases: ["c1", "c2"],
    })
    const properties = full.properties as Record<string, { items?: { enum: string[] } }>
    expect(properties.categoryNames?.items?.enum).toEqual(["HR", "IT"])
    expect(properties.chunkIds?.items?.enum).toEqual(["c1", "c2"])
    expect(full.required).toEqual(["suggestedTitle", "categoryNames", "chunkIds"])
  })
})

describe("buildTurnClassificationPrompt", () => {
  it("shows the exchange, the recent context, the categories and the passages", () => {
    const { systemPrompt, userContent } = buildTurnClassificationPrompt({
      earlierMessages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: [{ type: "text", text: "Hello! How can I help?" }] },
      ],
      userMessage: "How many days of leave?",
      answerText: "27 days.",
      availableCategoryNames: ["HR", "IT"],
      passages: [{ alias: "c1", documentTitle: "Handbook", content: "x".repeat(800) }],
    })

    expect(systemPrompt).toContain("You are a classifier")
    expect(userContent).toContain("user: Hi")
    expect(userContent).toContain("assistant: Hello! How can I help?")
    expect(userContent).toContain("## Latest user message\nHow many days of leave?")
    expect(userContent).toContain("## Assistant reply\n27 days.")
    expect(userContent).toContain("Available categories: HR, IT.")
    expect(userContent).toContain("- c1 (Handbook): ")
    // Long passages are truncated for the classifier.
    expect(userContent).not.toContain("x".repeat(800))
  })

  it("omits the category and passage sections when there is nothing to classify there", () => {
    const { userContent } = buildTurnClassificationPrompt({
      earlierMessages: [],
      userMessage: "hi",
      answerText: "Hello!",
      availableCategoryNames: [],
      passages: [],
    })
    expect(userContent).not.toContain("## Categories")
    expect(userContent).not.toContain("## Retrieved passages")
    expect(userContent).not.toContain("## Earlier conversation")
  })
})

describe("runTurnClassification", () => {
  const baseParams = {
    metadata,
    buildConfig,
    earlierMessages: [],
    userMessage: "How many days of leave?",
    answerText: "27 days.",
  }

  it("logs inline citations as sources without asking the classifier about them", async () => {
    const registry = createRetrievedChunksRegistry()
    registry.register(chunk({}))
    const executions: ToolExecutionLog[] = []
    const { provider, generateStructuredOutput } = fakeProvider({ suggestedTitle: "Leave" })
    const recalculator = fakeRecalculator()

    await runTurnClassification({
      ...baseParams,
      context: {
        retrievedChunksRegistry: registry,
        sessionMetadata: {
          connectScope,
          sessionId: "session-1",
          availableCategoryNames: [],
          metadataRecalculator: recalculator,
        },
        onExecute: (execution) => {
          executions.push(execution)
        },
      },
      provider,
      citedChunkAliases: ["c1"],
    })

    expect(executions.map((execution) => execution.toolName)).toEqual([
      ToolName.Sources,
      ToolName.RecalculateConversationSessionMetadata,
    ])
    const schema = generateStructuredOutput.mock.calls[0]?.[0]?.schema as {
      properties: Record<string, unknown>
    }
    expect(Object.keys(schema.properties)).toEqual(["suggestedTitle"])
    expect(recalculator.recalculateSessionMetadataFromMessages).toHaveBeenCalledWith({
      connectScope,
      sessionId: "session-1",
      selectedCategoryNames: [],
      suggestedTitle: "Leave",
    })
    // The classification call is tagged so traces can be filtered.
    expect(generateStructuredOutput.mock.calls[0]?.[0]?.metadata.tags).toContain(
      "turn-classification",
    )
  })

  it("asks the classifier for the sources when nothing was cited inline", async () => {
    const registry = createRetrievedChunksRegistry()
    registry.register(chunk({}))
    const executions: ToolExecutionLog[] = []
    const { provider, generateStructuredOutput } = fakeProvider({
      suggestedTitle: "Leave",
      categoryNames: ["HR"],
      chunkIds: ["c1"],
    })
    const recalculator = fakeRecalculator()

    await runTurnClassification({
      ...baseParams,
      context: {
        retrievedChunksRegistry: registry,
        sessionMetadata: {
          connectScope,
          sessionId: "session-1",
          availableCategoryNames: ["HR", "IT"],
          metadataRecalculator: recalculator,
        },
        onExecute: (execution) => {
          executions.push(execution)
        },
      },
      provider,
      citedChunkAliases: [],
    })

    const schema = generateStructuredOutput.mock.calls[0]?.[0]?.schema as {
      properties: Record<string, unknown>
    }
    expect(Object.keys(schema.properties)).toEqual(["suggestedTitle", "categoryNames", "chunkIds"])
    expect(executions.map((execution) => execution.toolName)).toEqual([
      ToolName.Sources,
      ToolName.RecalculateConversationSessionMetadata,
    ])
    expect(executions[1]?.arguments).toEqual({ suggestedTitle: "Leave", categoryNames: ["HR"] })
  })

  it("skips the classifier entirely when the turn has nothing to record", async () => {
    const registry = createRetrievedChunksRegistry() // no lookup ran
    const { provider, generateStructuredOutput } = fakeProvider({})

    await runTurnClassification({
      ...baseParams,
      context: { retrievedChunksRegistry: registry, onExecute: () => undefined },
      provider,
      citedChunkAliases: [],
    })

    expect(generateStructuredOutput).not.toHaveBeenCalled()
  })

  it("never throws: a provider failure or a malformed output is logged and dropped", async () => {
    const recalculator = fakeRecalculator()
    const context = {
      sessionMetadata: {
        connectScope,
        sessionId: "session-1",
        availableCategoryNames: [],
        metadataRecalculator: recalculator,
      },
      onExecute: () => undefined,
    }

    await expect(
      runTurnClassification({
        ...baseParams,
        context,
        provider: fakeProvider(new Error("provider down")).provider,
        citedChunkAliases: [],
      }),
    ).resolves.toBeUndefined()
    await expect(
      runTurnClassification({
        ...baseParams,
        context,
        provider: fakeProvider({ suggestedTitle: 42 }).provider,
        citedChunkAliases: [],
      }),
    ).resolves.toBeUndefined()
    expect(recalculator.recalculateSessionMetadataFromMessages).not.toHaveBeenCalled()
  })

  it("truncates an overlong title instead of dropping the report", async () => {
    const recalculator = fakeRecalculator()
    await runTurnClassification({
      ...baseParams,
      context: {
        sessionMetadata: {
          connectScope,
          sessionId: "session-1",
          availableCategoryNames: [],
          metadataRecalculator: recalculator,
        },
        onExecute: () => undefined,
      },
      provider: fakeProvider({ suggestedTitle: "t".repeat(200) }).provider,
      citedChunkAliases: [],
    })
    expect(
      recalculator.recalculateSessionMetadataFromMessages.mock.calls[0]?.[0]?.suggestedTitle,
    ).toHaveLength(120)
  })
})
