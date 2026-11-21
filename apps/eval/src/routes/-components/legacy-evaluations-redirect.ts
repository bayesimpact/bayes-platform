import type { AgentTypeDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { notFound, redirect } from "@tanstack/react-router"
import {
  agentPathParams,
  flattenEvaluationAgents,
  loadEvaluationWorkspace,
  readLastAgentId,
} from "@/features/agents"
import { runIdsOf } from "@/lib/compare-runs-search"

/**
 * Sends a URL of the former evaluation app, which named a project and not an agent, to the same
 * page under an agent of the project: `conversation` or `extraction`, then a dataset, then one
 * of its runs or their comparison. The Studio's links and people's bookmarks still use them. A
 * run opens under the agent it asked, and a comparison under the agent its first run asked, as it
 * shows that agent's runs only; any other page under the agent the person opened last, when it
 * is one of that type, else the first of them.
 */
export async function redirectFromLegacyEvaluationsUrl({
  queryClient,
  project,
  type,
  path,
  runs,
  loadRunAgentId,
}: {
  queryClient: QueryClient
  project: ProjectParamsDto
  /** The type of agent the URL is about. */
  type: AgentTypeDto
  /** What follows `conversation/` or `extraction/` in the URL. */
  path: string
  /** The `runs` search param of a comparison. */
  runs: string | undefined
  /** The agent a run asked, or none for a run that is gone. */
  loadRunAgentId: (runId: string) => Promise<string | null>
}): Promise<never> {
  const { groups } = await loadEvaluationWorkspace(queryClient)
  const agents = flattenEvaluationAgents(groups).filter(
    (agent) =>
      agent.type === type &&
      agent.project.id === project.projectId &&
      agent.project.organization.id === project.organizationId,
  )
  const [datasetId, section, runId] = path.split("/").filter(Boolean)
  // The run that decides the agent: the run of the page, or the first one of a comparison.
  const [firstComparedRunId] = runIdsOf(runs)
  const shownRunId =
    section === "runs" ? runId : section === "compare" ? firstComparedRunId : undefined
  const runAgentId = shownRunId ? await loadRunAgentId(shownRunId) : null
  const agent =
    agents.find((candidate) => candidate.id === runAgentId) ??
    agents.find((candidate) => candidate.id === readLastAgentId()) ??
    agents[0]
  if (!agent) throw notFound()
  const params = agentPathParams(agent)
  if (!datasetId) {
    throw redirect({
      to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations",
      params,
      replace: true,
    })
  }
  if (section === "runs" && runId) {
    throw redirect({
      to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId",
      params: { ...params, datasetId, runId },
      replace: true,
    })
  }
  if (section === "compare") {
    throw redirect({
      to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/compare",
      params: { ...params, datasetId },
      search: { runs },
      replace: true,
    })
  }
  throw redirect({
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
    params: { ...params, datasetId },
    replace: true,
  })
}
