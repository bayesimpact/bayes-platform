import type {
  ConversationSessionOutputDto,
  ProjectAgentOutputDto,
} from "@caseai-connect/desk-contracts"
import { appBasePath } from "@/app/config"
import type { DeskWorld } from "./factories/desk-world.factory"
import { required } from "./required"

/**
 * The URLs of a world's pages, under the Desk's base, and the entities they open. Each helper
 * throws when the world lacks what it names, so a test never opens `/a/undefined`.
 */

/** The agent of that name, or the world's first agent. */
export function agentOf(world: DeskWorld, agentName?: string): ProjectAgentOutputDto {
  return agentName === undefined
    ? required(world.agents[0], "an agent in the world")
    : required(
        world.agents.find((agent) => agent.name === agentName),
        `the agent "${agentName}"`,
      )
}

type ConversationLookup = {
  /** The position in the agent's history, newest first: the latest one by default. */
  position?: number
  /** The agent, the world's first one by default. */
  agentName?: string
}

/** A conversation of an agent's history. */
export function conversationOf(
  world: DeskWorld,
  { position = 0, agentName }: ConversationLookup = {},
): ConversationSessionOutputDto {
  const agent = agentOf(world, agentName)
  return required(
    world.conversations[agent.id]?.[position],
    `the conversation at position ${position} of "${agent.name}"`,
  )
}

/** The page of a project, which opens its first agent. */
export function projectUrlOf(world: DeskWorld, projectName: string): string {
  const project = required(
    world.projects.find((candidate) => candidate.name === projectName),
    `the project "${projectName}"`,
  )
  return `${appBasePath}o/${project.organizationId}/p/${project.id}`
}

/** The page of an agent: a new conversation, or a new extraction for an extraction agent. */
export function agentUrlOf(world: DeskWorld, agentName?: string): string {
  const agent = agentOf(world, agentName)
  const project = required(
    world.projects.find((candidate) => candidate.id === agent.projectId),
    `the project of "${agent.name}"`,
  )
  return `${appBasePath}o/${project.organizationId}/p/${project.id}/a/${agent.id}`
}

/** The page of a conversation of an agent's history. */
export function conversationUrlOf(world: DeskWorld, lookup: ConversationLookup = {}): string {
  const { id } = conversationOf(world, lookup)
  return `${agentUrlOf(world, lookup.agentName)}/as/${id}`
}

/** The pages of the world's extraction agent: a new extraction, and its runs by file name. */
export function extractionUrlsOf(world: DeskWorld) {
  const reader = required(
    world.agents.find((agent) => agent.type === "extraction"),
    "an extraction agent in the world",
  )
  const agentUrl = agentUrlOf(world, reader.name)
  const documentOf = (fileName: string) =>
    required(
      (world.extractionDocuments[reader.id] ?? []).find(
        (document) => document.fileName === fileName,
      ),
      `the document "${fileName}"`,
    )
  return {
    newExtractionUrl: `${agentUrl}/extraction`,
    /** The extraction of the document of that name. */
    runUrl: (fileName: string) => {
      const run = required(
        (world.extractionRuns[reader.id] ?? []).find(
          (candidate) => candidate.documentFileName === fileName,
        ),
        `the extraction of "${fileName}"`,
      )
      return `${agentUrl}/extraction/runs/${run.id}`
    },
    /** The setup of the CSV file of that name, before it runs. */
    csvSetupUrl: (fileName: string) => `${agentUrl}/extraction/csv/${documentOf(fileName).id}`,
    /** The run of the CSV file of that name. */
    csvRunUrl: (fileName: string) => {
      const { id: csvDocumentId } = documentOf(fileName)
      const run = required(
        (world.csvExtractionRuns[reader.id] ?? []).find(
          (candidate) => candidate.csvDocumentId === csvDocumentId,
        ),
        `the CSV run of "${fileName}"`,
      )
      return `${agentUrl}/extraction/csv-runs/${run.id}`
    },
  }
}

/** A URL of the Desk as its router's location names it, without the base. */
export function routerPathOf(url: string): string {
  return url.slice(appBasePath.length - 1)
}
