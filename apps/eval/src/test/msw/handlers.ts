import {
  EvalAccountRoutes,
  EvalAgentsRoutes,
  EvalOrganizationsRoutes,
  EvalProjectsRoutes,
} from "@caseai-connect/eval-contracts"
import { buildMe } from "../factories/account.factory"
import { buildEvalWorld, type EvalWorld } from "../factories/eval-world.factory"
import { mockRoute } from "./mock-route"

/** The routes that read a world: the person's projects, organizations and the agents of each. */
export function worldHandlers(world: EvalWorld) {
  return [
    mockRoute(EvalProjectsRoutes.getAllMine, () => world.projects),
    mockRoute(EvalOrganizationsRoutes.getAllMine, () => world.organizations),
    mockRoute(EvalAgentsRoutes.getAllOfProject, ({ params }) =>
      world.agents.filter((agent) => agent.projectId === params.projectId),
    ),
  ]
}

/** The API as each test starts from it: the signed-in person, and the main world, built afresh. */
export function evalHandlers(world: EvalWorld = buildEvalWorld()) {
  return [mockRoute(EvalAccountRoutes.getMe, () => buildMe()), ...worldHandlers(world)]
}
