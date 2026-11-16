import {
  EvalAgentsRoutes,
  EvalOrganizationsRoutes,
  EvalProjectsRoutes,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { type EvaluationWorkspace, groupEvaluationAgents } from "../evaluation-agents"
import { listEvaluationProjects } from "../evaluation-projects"
import { evaluationAgentKeys } from "./keys"

/**
 * What the person can evaluate: the projects (`GET projects/mine`) and organizations
 * (`GET organizations/mine`) in parallel, then the agents of every project that grants evaluation,
 * drafts included, in parallel. One key holds them all.
 */
export const evaluationWorkspaceQueryOptions = () =>
  queryOptions({
    queryKey: evaluationAgentKeys.all,
    queryFn: async ({ signal }): Promise<EvaluationWorkspace> => {
      const [projects, organizations] = await Promise.all([
        apiRequest(EvalProjectsRoutes.getAllMine, { signal }),
        apiRequest(EvalOrganizationsRoutes.getAllMine, { signal }),
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
      }
    },
  })
