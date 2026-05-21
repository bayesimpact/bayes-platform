import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { Evaluation } from "./evaluations.models"

type EvaluationTransientParams = {
  project: Project
}

class EvaluationFactory extends Factory<Evaluation, EvaluationTransientParams> {}

export const evaluationFactory = EvaluationFactory.define(({ params, transientParams }) => {
  const { project } = transientParams
  if (!project) {
    throw new Error("Project must be provided in transient params to build an Evaluation")
  }

  return {
    id: params.id ?? faker.string.uuid(),
    projectId: project.id,
    input: params.input ?? faker.lorem.sentence(),
    expectedOutput: params.expectedOutput ?? faker.lorem.sentence(),
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
  }
})
