import {
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
 * once per role) in parallel, then the agents of every project the app opens, drafts included, in
 * parallel. One key holds them all.
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
