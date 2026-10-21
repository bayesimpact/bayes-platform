import type {
  ConversationMessageOutputDto,
  ConversationSessionOutputDto,
  CsvExtractionRecordOutputDto,
  CsvExtractionRunDetailOutputDto,
  CsvFileColumnOutputDto,
  ExtractionDocumentOutputDto,
  ExtractionRunDetailOutputDto,
  ExtractionRunOutputDto,
  MemoryOutputDto,
  MyOrganizationOutputDto,
  MyProjectOutputDto,
  ProjectAgentOutputDto,
} from "@caseai-connect/desk-contracts"
import {
  buildConversationMessage,
  buildConversationSession,
  buildCsvExtractionRun,
  buildExtractionRun,
  daysAgo,
} from "./agent-sessions.factory"
import { buildProjectAgent } from "./agents.factory"
import {
  buildCsvFileColumns,
  buildCsvRecords,
  buildExtractionDocument,
  buildExtractionRunDetail,
  columnSchemaOf,
} from "./extractions.factory"
import { buildMyOrganization, buildMyProject } from "./projects.factory"

/** Everything the mocked API answers: projects, their agents, and the history of each agent. */
export type DeskWorld = {
  organizations: MyOrganizationOutputDto[]
  projects: MyProjectOutputDto[]
  agents: ProjectAgentOutputDto[]
  conversations: Record<string, ConversationSessionOutputDto[]>
  extractionRuns: Record<string, ExtractionRunOutputDto[]>
  csvExtractionRuns: Record<string, CsvExtractionRunDetailOutputDto[]>
  /** The messages of each conversation, oldest first. */
  messages: Record<string, ConversationMessageOutputDto[]>
  /** The problems reported on the agents' replies. */
  feedbacks: { agentMessageId: string; content: string }[]
  /** What each agent remembers about the person. */
  memories: Record<string, MemoryOutputDto[]>
  /** The documents the person uploaded for each extraction agent. */
  extractionDocuments: Record<string, ExtractionDocumentOutputDto[]>
  /** The detail of each extraction of a document, by its id. */
  extractionRunDetails: Record<string, ExtractionRunDetailOutputDto>
  /** The columns of each uploaded CSV file, by the document's id. */
  csvColumns: Record<string, CsvFileColumnOutputDto[]>
  /** The rows of each CSV run, by the run's id. */
  csvRecords: Record<string, CsvExtractionRecordOutputDto[]>
}

function emptyWorld(): DeskWorld {
  return {
    organizations: [],
    projects: [],
    agents: [],
    conversations: {},
    extractionRuns: {},
    csvExtractionRuns: {},
    messages: {},
    feedbacks: [],
    memories: {},
    extractionDocuments: {},
    extractionRunDetails: {},
    csvColumns: {},
    csvRecords: {},
  }
}

/** A short exchange, for a conversation of the history. */
function buildExchange(question: string, createdAt: number): ConversationMessageOutputDto[] {
  return [
    buildConversationMessage({ content: "Hello! How can I help you today?", createdAt }),
    buildConversationMessage({ role: "user", content: question, createdAt }),
    buildConversationMessage({
      content: [
        "Here is a short comparison of the **two plans**:",
        "",
        "| Plan | Teams | Support |",
        "| --- | --- | --- |",
        "| Starter | 1 | Email |",
        "| Pro | Unlimited | Priority |",
        "",
        "The Pro plan also adds:",
        "",
        "- shared workspaces,",
        "- the integrations, such as `webhooks`.",
      ].join("\n"),
      createdAt,
      toolCalls: [
        { id: crypto.randomUUID(), name: "lookup_knowledge_base", arguments: {} },
        {
          id: crypto.randomUUID(),
          name: "surfaceResources",
          arguments: {
            resources: [
              {
                id: crypto.randomUUID(),
                title: "Plan comparison",
                description: "Every plan, side by side.",
                link: "https://example.org/plans",
              },
            ],
          },
        },
        {
          id: crypto.randomUUID(),
          name: "sources",
          arguments: {
            sources: [
              {
                documentId: PRICING_GUIDE_ID,
                documentTitle: "Pricing guide.pdf",
                documentSourceType: "project",
                chunks: [{ chunkId: "c1", partialContent: "The Pro plan covers unlimited teams…" }],
              },
              {
                documentId: crypto.randomUUID(),
                documentTitle: "Help center",
                documentSourceType: "webCrawl",
                chunks: [{ chunkId: "c2", partialContent: "Support answers by email…" }],
              },
            ],
          },
        },
      ],
    }),
  ]
}

/** A document the replies cite, shared with every member of the project. */
const PRICING_GUIDE_ID = "0b6c8f1e-7a52-4d39-9a51-3f6e0d2c4b11"

/** A conversation history spread over the date groups of the sidebar. */
function buildConversationHistory(): ConversationSessionOutputDto[] {
  return [
    buildConversationSession({
      title: "Compare the plans",
      createdAt: daysAgo(0),
      forms: [
        {
          agentId: crypto.randomUUID(),
          agentName: "Helpful Assistant",
          status: "in_progress",
          state: { teamSize: 5, plan: "Pro" },
          outputJsonSchema: {
            properties: { teamSize: { type: "number" }, plan: { type: "string" }, startDate: {} },
            propertyOrdering: ["teamSize", "plan", "startDate"],
          },
          updatedAt: daysAgo(0),
        },
      ],
    }),
    buildConversationSession({ title: "Summarize the release notes", createdAt: daysAgo(0) }),
    buildConversationSession({ title: "Draft a reply to a question", createdAt: daysAgo(1) }),
    buildConversationSession({ title: undefined, createdAt: daysAgo(3) }),
    buildConversationSession({ title: "List the open tickets", createdAt: daysAgo(12) }),
    buildConversationSession({ title: "Rewrite the welcome email", createdAt: daysAgo(45) }),
  ]
}

/**
 * An extraction history mixing documents and CSV files: a report read, notes being read, a scan
 * that failed, and a CSV file of articles run row by row. A contract waits for its first run.
 */
function addExtractionHistory(world: DeskWorld, agent: ProjectAgentOutputDto): void {
  const report = buildExtractionDocument({ createdAt: daysAgo(0) })
  const notes = buildExtractionDocument({
    fileName: "meeting-notes.md",
    mimeType: "text/markdown",
    size: 18_000,
    createdAt: daysAgo(0),
  })
  const scan = buildExtractionDocument({
    fileName: "scanned-manual.pdf",
    size: 24_500_000,
    createdAt: daysAgo(2),
  })
  const articles = buildExtractionDocument({
    fileName: "articles.csv",
    mimeType: "text/csv",
    size: 64_000,
    createdAt: daysAgo(1),
  })
  const contract = buildExtractionDocument({ fileName: "contract.pdf", createdAt: daysAgo(6) })
  world.extractionDocuments[agent.id] = [report, notes, articles, scan, contract]

  const runOf = (document: ExtractionDocumentOutputDto, status: "success" | "pending" | "failed") =>
    buildExtractionRun({
      documentId: document.id,
      documentFileName: document.fileName ?? null,
      status,
      createdAt: document.createdAt,
    })
  const runs = [runOf(report, "success"), runOf(notes, "pending"), runOf(scan, "failed")]
  world.extractionRuns[agent.id] = runs
  for (const run of runs) world.extractionRunDetails[run.id] = buildExtractionRunDetail(run)

  const columns = buildCsvFileColumns()
  world.csvColumns[articles.id] = columns
  const records = buildCsvRecords(columns, 24, "success")
  const failedRecord = records[5]
  if (failedRecord) {
    failedRecord.status = "error"
    failedRecord.agentRawOutput = null
    failedRecord.errorDetails = "The model did not answer in time."
  }
  const csvRun = buildCsvExtractionRun({
    csvDocumentId: articles.id,
    columnSchema: columnSchemaOf(columns),
    status: "completed",
    summary: { total: 24, processed: 24, errors: 1, running: 0 },
    csvExportDocumentId: crypto.randomUUID(),
    createdAt: articles.createdAt,
    updatedAt: articles.createdAt + 95_000,
  })
  world.csvExtractionRuns[agent.id] = [csvRun]
  world.csvRecords[csvRun.id] = records
}

/**
 * The main case: one project opens the Desk, with one conversation agent and its history. Another
 * project, "Billing", does not open the Desk.
 */
export function buildDeskWorld(): DeskWorld {
  const world = emptyWorld()
  const product = buildMyOrganization({ name: "Product" })
  const support = buildMyProject(product, { name: "Support" })
  const billing = buildMyProject(product, { name: "Billing", permissions: ["project.read"] })
  const assistant = buildProjectAgent(support, { name: "Helpful Assistant" })
  world.organizations = [product]
  world.projects = [support, billing]
  world.agents = [assistant, buildProjectAgent(billing, { name: "Billing Assistant" })]
  world.conversations[assistant.id] = buildConversationHistory()
  addMessages(world, assistant.id)
  addMemories(world, assistant.id)
  addMcpApp(world, assistant.id)
  return world
}

/** The MCP App the replies of the mock world show. */
export const RELEASE_NOTES_APP = {
  mcpServerId: "release-server",
  resourceUri: "ui://release-notes/card",
}

/** The second conversation's last reply shows an MCP App card, with a bare "." as its text. */
function addMcpApp(world: DeskWorld, agentId: string): void {
  const [, secondConversation] = world.conversations[agentId] ?? []
  const reply = (world.messages[secondConversation?.id ?? ""] ?? []).at(-1)
  if (!reply) return
  reply.content = "."
  reply.toolCalls = [
    {
      id: crypto.randomUUID(),
      name: "list_releases",
      arguments: { month: "October" },
      mcpApp: RELEASE_NOTES_APP,
      result: {
        content: [{ type: "text", text: "Three releases this month: 2.1, 2.2 and 2.3." }],
        structuredContent: { releases: ["2.1: faster search", "2.2: dark mode", "2.3: exports"] },
      },
    },
  ]
}

/**
 * The agent remembers one fact about the person and proposes another, both from the last reply
 * of its first conversation.
 */
function addMemories(world: DeskWorld, agentId: string): void {
  const saved = { id: crypto.randomUUID(), content: "Works in a team of five", status: "saved" }
  const proposed = { id: crypto.randomUUID(), content: "Prefers short answers", status: "pending" }
  world.memories[agentId] = [saved, proposed].map((memory) => ({
    ...memory,
    status: memory.status as "saved" | "pending",
    createdAt: daysAgo(0),
  }))
  const [firstConversation] = world.conversations[agentId] ?? []
  const reply = (world.messages[firstConversation?.id ?? ""] ?? []).at(-1)
  reply?.toolCalls?.push({
    id: crypto.randomUUID(),
    name: "saveMemory",
    arguments: {},
    result: { memories: [saved, proposed] },
  })
}

/** Gives every conversation of an agent's history a short exchange. */
function addMessages(world: DeskWorld, agentId: string): void {
  for (const conversation of world.conversations[agentId] ?? []) {
    world.messages[conversation.id] = buildExchange(
      conversation.title ?? "Compare the plans",
      conversation.createdAt,
    )
  }
}

/** One project with several agents, an extraction agent among them. */
export function buildSeveralAgentsWorld(): DeskWorld {
  const world = emptyWorld()
  const product = buildMyOrganization({ name: "Product" })
  const support = buildMyProject(product, { name: "Support" })
  const assistant = buildProjectAgent(support, { name: "Helpful Assistant" })
  const writer = buildProjectAgent(support, { name: "Writing Helper" })
  const reader = buildProjectAgent(support, { name: "Document Reader", type: "extraction" })
  world.organizations = [product]
  world.projects = [support]
  world.agents = [reader, assistant, writer]
  world.conversations[assistant.id] = buildConversationHistory()
  world.conversations[writer.id] = [buildConversationSession({ title: "Shorten this paragraph" })]
  addMessages(world, assistant.id)
  addMessages(world, writer.id)
  addExtractionHistory(world, reader)
  return world
}

/** Several projects in two organizations, each with its agents. */
export function buildSeveralProjectsWorld(): DeskWorld {
  const world = emptyWorld()
  const product = buildMyOrganization({ name: "Product" })
  const operations = buildMyOrganization({ name: "Operations" })
  const pricing = buildMyProject(product, { name: "Pricing" })
  const support = buildMyProject(product, { name: "Support" })
  const helpCenter = buildMyProject(operations, { name: "Help center" })
  const pricingAssistant = buildProjectAgent(pricing, { name: "Pricing Assistant" })
  const supportAssistant = buildProjectAgent(support, { name: "Helpful Assistant" })
  const reader = buildProjectAgent(support, { name: "Document Reader", type: "extraction" })
  const guide = buildProjectAgent(helpCenter, { name: "Help Center Guide" })
  world.organizations = [product, operations]
  world.projects = [pricing, support, helpCenter]
  world.agents = [pricingAssistant, supportAssistant, reader, guide]
  world.conversations[pricingAssistant.id] = [buildConversationSession({ title: "Compare plans" })]
  world.conversations[supportAssistant.id] = buildConversationHistory()
  addMessages(world, pricingAssistant.id)
  addMessages(world, supportAssistant.id)
  addExtractionHistory(world, reader)
  return world
}

/** A single extraction agent. */
export function buildExtractionAgentWorld(): DeskWorld {
  const world = emptyWorld()
  const product = buildMyOrganization({ name: "Product" })
  const support = buildMyProject(product, { name: "Support" })
  const reader = buildProjectAgent(support, { name: "Document Reader", type: "extraction" })
  world.organizations = [product]
  world.projects = [support]
  world.agents = [reader]
  addExtractionHistory(world, reader)
  return world
}

/** The main case, before the first conversation. */
export function buildEmptyHistoryWorld(): DeskWorld {
  const world = buildDeskWorld()
  world.conversations = {}
  world.messages = {}
  return world
}

/** A project opens the Desk, but the person is a member of none of its agents. */
export function buildNoAgentWorld(): DeskWorld {
  const world = buildDeskWorld()
  world.agents = []
  world.conversations = {}
  return world
}
