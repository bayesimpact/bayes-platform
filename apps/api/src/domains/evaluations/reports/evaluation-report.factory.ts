import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Repository } from "typeorm"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Evaluation } from "@/domains/evaluations/evaluation.entity"
import type { EvaluationReport } from "@/domains/evaluations/reports/evaluation-report.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"

type EvaluationReportTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  agentSettings: AgentSettings
  evaluation: Evaluation
}

class EvaluationReportFactory extends Factory<EvaluationReport, EvaluationReportTransientParams> {}

export const evaluationReportFactory = EvaluationReportFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.agent) {
      throw new Error("agent transient is required")
    }
    if (!transientParams.agentSettings) {
      throw new Error("agentSettings transient is required")
    }
    if (!transientParams.evaluation) {
      throw new Error("evaluation transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      agentId: transientParams.agent.id,
      agentSettingsId: transientParams.agentSettings.id,
      evaluationId: transientParams.evaluation.id,
      agent: transientParams.agent,
      agentSettings: transientParams.agentSettings,
      evaluation: transientParams.evaluation,
      traceId: randomUUID(),
      output: params.output || "the output",
      score: params.score || "42",
    } satisfies EvaluationReport
  },
)

type CreateEvaluationReportForEvaluationParams = {
  evaluationReport?: Partial<EvaluationReport>
}

type CreateEvaluationReportForEvaluationRepositories = {
  evaluationReportRepository: Repository<EvaluationReport>
}

export async function createEvaluationReportForEvaluation({
  repositories,
  organization,
  project,
  agent,
  evaluation,
  params = {},
}: {
  repositories: CreateEvaluationReportForEvaluationRepositories
  organization: Organization
  project: Project
  agent: Agent
  evaluation: Evaluation
  params?: CreateEvaluationReportForEvaluationParams
}): Promise<EvaluationReport> {
  const evaluationReport = evaluationReportFactory
    .transient({ organization, project, agent, evaluation })
    .build(params.evaluationReport)
  await repositories.evaluationReportRepository.save(evaluationReport)
  return evaluationReport
}
