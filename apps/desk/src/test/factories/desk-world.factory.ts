import type {
  ConversationMessageOutputDto,
  ConversationSessionOutputDto,
  CsvExtractionRunOutputDto,
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
import { buildMyOrganization, buildMyProject } from "./projects.factory"

/** Everything the mocked API answers: projects, their agents, and the history of each agent. */
export type DeskWorld = {
  organizations: MyOrganizationOutputDto[]
  projects: MyProjectOutputDto[]
  agents: ProjectAgentOutputDto[]
  conversations: Record<string, ConversationSessionOutputDto[]>
  extractionRuns: Record<string, ExtractionRunOutputDto[]>
  csvExtractionRuns: Record<string, CsvExtractionRunOutputDto[]>
  /** The messages of each conversation, oldest first. */
  messages: Record<string, ConversationMessageOutputDto[]>
  /** The problems reported on the agents' replies. */
  feedbacks: { agentMessageId: string; content: string }[]
  /** What each agent remembers about the person. */
  memories: Record<string, MemoryOutputDto[]>
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

/** An extraction history mixing documents and CSV files. */
function addExtractionHistory(world: DeskWorld, agent: ProjectAgentOutputDto): void {
  world.extractionRuns[agent.id] = [
    buildExtractionRun({ documentFileName: "summary.pdf", createdAt: daysAgo(0) }),
    buildExtractionRun({ documentFileName: "notes.pdf", status: "pending", createdAt: daysAgo(0) }),
    buildExtractionRun({ documentFileName: null, status: "failed", createdAt: daysAgo(2) }),
  ]
  world.csvExtractionRuns[agent.id] = [buildCsvExtractionRun({ createdAt: daysAgo(1) })]
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
  return world
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
