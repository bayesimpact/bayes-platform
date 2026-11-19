import type { EvalWorld } from "./factories/eval-world.factory"
import { required } from "./required"

/** The URL of an agent's page, the first of the world by default. */
export function agentUrlOf(world: EvalWorld, agentName?: string): string {
  const agent = required(
    world.agents.find((candidate) => agentName === undefined || candidate.name === agentName),
    `the agent ${agentName ?? "of the world"}`,
  )
  const project = required(
    world.projects.find((candidate) => candidate.id === agent.projectId),
    `the project of ${agent.name}`,
  )
  return `/eval/o/${project.organizationId}/p/${project.id}/a/${agent.id}`
}

/** The URL of an agent's evaluations, where an agent that opens nothing else lands. */
export function evaluationsUrlOf(world: EvalWorld, agentName?: string): string {
  return `${agentUrlOf(world, agentName)}/evaluations`
}

/** The URL of a conversation dataset of the world's first agent, by its name. */
export function conversationDatasetUrlOf(world: EvalWorld, datasetName: string): string {
  const { dataset } = required(
    world.conversationDatasets.find((candidate) => candidate.dataset.name === datasetName),
    `the dataset ${datasetName}`,
  )
  return `${evaluationsUrlOf(world)}/${dataset.id}`
}

/** The URL of the first run of the world that stands at that status, on its dataset's page. */
export function conversationRunUrlOf(
  world: EvalWorld,
  status: "running" | "completed" | "failed",
): string {
  const { run } = required(
    world.conversationRuns.find((candidate) => candidate.run.status === status),
    `a ${status} run`,
  )
  return `${evaluationsUrlOf(world)}/${run.evaluationConversationDatasetId}/runs/${run.id}`
}

/** A campaign of the world, by its name. */
export function campaignOf(world: EvalWorld, campaignName: string) {
  return required(
    world.campaigns.find((candidate) => candidate.name === campaignName),
    `the campaign ${campaignName}`,
  )
}

/** The URL of the campaigns of the world's first agent, for who manages them. */
export function campaignsUrlOf(world: EvalWorld): string {
  return `${agentUrlOf(world)}/review-campaigns`
}

/** The URL of a campaign's editor, for who manages it. */
export function campaignEditorUrlOf(world: EvalWorld, campaignName: string): string {
  return `${campaignsUrlOf(world)}/${campaignOf(world, campaignName).id}`
}

/** The URL of a campaign for its participants, to which `/test` or `/review` is added. */
export function campaignUrlOf(world: EvalWorld, campaignName: string): string {
  const campaign = campaignOf(world, campaignName)
  return `/eval/o/${campaign.organizationId}/p/${campaign.projectId}/review-campaigns/${campaign.id}`
}

/** The URL of a session a reviewer reads, by its place in the campaign's list, from 0. */
export function reviewSessionUrlOf(world: EvalWorld, campaignName: string, index: number): string {
  const session = required(
    world.reviewSessions[campaignOf(world, campaignName).id]?.[index],
    `session ${index} of ${campaignName}`,
  )
  return `${campaignUrlOf(world, campaignName)}/review/sessions/${session.sessionId}`
}

/** The URL of a session the tester started, by its place in the campaign's list, from 0. */
export function testerSessionUrlOf(world: EvalWorld, campaignName: string, index: number): string {
  const session = required(
    world.testerSessions[campaignOf(world, campaignName).id]?.[index],
    `tester session ${index} of ${campaignName}`,
  )
  return `${campaignUrlOf(world, campaignName)}/test/sessions/${session.id}`
}

/** The router's path of a URL of the app: the URL without the base path. */
export function routerPathOf(url: string): string {
  return url.replace(/^\/eval/, "")
}
