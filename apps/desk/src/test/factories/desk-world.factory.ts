import type {
  ConversationSessionOutputDto,
  CsvExtractionRunOutputDto,
  ExtractionRunOutputDto,
  MyOrganizationOutputDto,
  MyProjectOutputDto,
  ProjectAgentOutputDto,
} from "@caseai-connect/desk-contracts"
import {
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
}

function emptyWorld(): DeskWorld {
  return {
    organizations: [],
    projects: [],
    agents: [],
    conversations: {},
    extractionRuns: {},
    csvExtractionRuns: {},
  }
}

/** A conversation history spread over the date groups of the sidebar. */
function buildConversationHistory(): ConversationSessionOutputDto[] {
  return [
    buildConversationSession({ title: "Compare the plans", createdAt: daysAgo(0) }),
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
  return world
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
  return world
}

/** A project opens the Desk, but the person is a member of none of its agents. */
export function buildNoAgentWorld(): DeskWorld {
  const world = buildDeskWorld()
  world.agents = []
  world.conversations = {}
  return world
}
