import {
  EVALUATION_UI_READ_PERMISSION,
  type MyProjectOutputDto,
} from "@caseai-connect/eval-contracts"

/** The projects where the person holds `evaluation.ui.read`: those they can evaluate. */
export function listEvaluationProjects(projects: MyProjectOutputDto[]): MyProjectOutputDto[] {
  return projects.filter((project) => project.permissions.includes(EVALUATION_UI_READ_PERMISSION))
}
