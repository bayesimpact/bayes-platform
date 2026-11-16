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

/** The router's path of a URL of the app: the URL without the base path. */
export function routerPathOf(url: string): string {
  return url.replace(/^\/eval/, "")
}
