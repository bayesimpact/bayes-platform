import { EvalAccountRoutes, EvalProjectsRoutes } from "@caseai-connect/eval-contracts"
import { buildMe } from "../factories/account.factory"
import { buildMyProject } from "../factories/projects.factory"
import { mockRoute } from "./mock-route"

/** The API as each test starts from it: the signed-in person, an evaluator of one project. */
export function evalHandlers() {
  return [
    mockRoute(EvalAccountRoutes.getMe, () => buildMe()),
    mockRoute(EvalProjectsRoutes.getAllMine, () => [buildMyProject()]),
  ]
}

/** A person who holds no evaluator role: their only project opens the Desk alone. */
export function noEvaluationAccessHandlers() {
  return [
    mockRoute(EvalProjectsRoutes.getAllMine, () => [
      buildMyProject({ name: "Support", permissions: ["project.read", "desk.ui.read"] }),
    ]),
  ]
}
