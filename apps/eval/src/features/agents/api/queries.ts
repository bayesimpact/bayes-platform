import {
  type AgentParamsDto,
  EvalAgentsRoutes,
  EvalOrganizationsRoutes,
  EvalProjectsRoutes,
  EvalReviewCampaignsRoutes,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { type EvaluationWorkspace, groupEvaluationAgents } from "../evaluation-agents"
import { listEvaluationProjects } from "../evaluation-projects"
import { mergeMyCampaigns } from "../my-campaigns"
import { evaluationAgentKeys } from "./keys"

/**
 * What the app holds for the person: the projects (`GET projects/mine`), the organizations
 * (`GET organizations/mine`) and the campaigns they test or review (`GET me/review-campaigns`,
 * once per role) in parallel, then the agents of every project the app opens, those with a
 * version in production, in parallel. One key holds them all.
 */
export const evaluationWorkspaceQueryOptions = () =>
  queryOptions({
    queryKey: evaluationAgentKeys.all,
    queryFn: async ({ signal }): Promise<EvaluationWorkspace> => {
      const [projects, organizations, asTester, asReviewer] = await Promise.all([
        apiRequest(EvalProjectsRoutes.getAllMine, { signal }),
        apiRequest(EvalOrganizationsRoutes.getAllMine, { signal }),
        apiRequest(EvalReviewCampaignsRoutes.getAllMine, { query: { role: "tester" }, signal }),
        apiRequest(EvalReviewCampaignsRoutes.getAllMine, { query: { role: "reviewer" }, signal }),
      ])
      const evaluationProjects = listEvaluationProjects(projects, organizations)
      const agentsOfProjects = await Promise.all(
        evaluationProjects.map((project) =>
          apiRequest(EvalAgentsRoutes.getAllOfProject, {
            params: { organizationId: project.organization.id, projectId: project.id },
            signal,
          }),
        ),
      )
      return {
        projects: evaluationProjects,
        groups: groupEvaluationAgents(evaluationProjects, agentsOfProjects),
        myCampaigns: mergeMyCampaigns(asTester.reviewCampaigns, asReviewer.reviewCampaigns),
      }
    },
  })

/**
 * The saved versions of an agent's settings a campaign or an evaluation can run on, newest first: the draft, which
 * changes under the testers, is not one of them.
 */
export const agentVersionsQueryOptions = (agent: AgentParamsDto) =>
  queryOptions({
    queryKey: evaluationAgentKeys.versions(agent),
    queryFn: async ({ signal }) => {
      const versions = await apiRequest(EvalAgentsRoutes.getVersions, { params: agent, signal })
      return versions
        .filter((version) => !version.isDraft)
        .sort((first, second) => second.revision - first.revision)
    },
  })
