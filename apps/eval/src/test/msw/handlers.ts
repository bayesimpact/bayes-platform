import { EvalAccountRoutes } from "@caseai-connect/eval-contracts"
import { buildMe } from "../factories/account.factory"
import { mockRoute } from "./mock-route"

/** The API as each test starts from it: the signed-in person, built afresh. */
export function evalHandlers() {
  return [mockRoute(EvalAccountRoutes.getMe, () => buildMe())]
}
