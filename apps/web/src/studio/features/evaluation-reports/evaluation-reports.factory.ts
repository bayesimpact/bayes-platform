import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { Evaluation } from "@/studio/features/evaluations/evaluations.models"
import type { EvaluationReport } from "./evaluation-reports.models"

type EvaluationReportTransientParams = {
  evaluation: Evaluation
  agent: Agent
}

class EvaluationReportFactory extends Factory<EvaluationReport, EvaluationReportTransientParams> {}

export const evaluationReportFactory = EvaluationReportFactory.define(
  ({ params, transientParams }) => {
    const { evaluation, agent } = transientParams
    if (!evaluation) {
      throw new Error(
        "Evaluation must be provided in transient params to build an EvaluationReport",
      )
    }
    if (!agent) {
      throw new Error("Agent must be provided in transient params to build an EvaluationReport")
    }

    return {
      id: params.id ?? faker.string.uuid(),
      evaluationId: evaluation.id,
      agentId: agent.id,
      output: params.output ?? faker.lorem.sentence(),
      score: params.score ?? faker.number.int({ min: 0, max: 100 }).toString(),
      traceUrl: params.traceUrl ?? faker.internet.url(),
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)
