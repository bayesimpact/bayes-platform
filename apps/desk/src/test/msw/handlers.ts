import type {
  MeOutputDto,
  MyOrganizationOutputDto,
  MyProjectOutputDto,
} from "@caseai-connect/desk-contracts"
import { delay, HttpResponse, http } from "msw"
import { buildMe } from "../factories/account.factory"
import { buildHomeWorld } from "../factories/projects.factory"

/** `GET me`, answered with the given person. */
const meHandler = (me: MeOutputDto = buildMe()) =>
  http.get("*/api/me", () => HttpResponse.json({ data: me }))

/** `GET projects/mine`, answered with the given projects. */
export const myProjectsHandler = (projects: MyProjectOutputDto[]) =>
  http.get("*/api/projects/mine", () => HttpResponse.json({ data: projects }))

/** `GET organizations/mine`, answered with the given organizations. */
const myOrganizationsHandler = (organizations: MyOrganizationOutputDto[]) =>
  http.get("*/api/organizations/mine", () => HttpResponse.json({ data: organizations }))

const world = buildHomeWorld()

/** The API as the mock mode and the tests start from. */
export const handlers = [
  meHandler(),
  myProjectsHandler(world.projects),
  myOrganizationsHandler(world.organizations),
]

/**
 * Other states of the screens, for the mock mode: `/app/?mock=empty`, `?mock=error`, `?mock=loading`.
 */
export const mockScenarios = {
  empty: [myProjectsHandler([])],
  error: [http.get("*/api/projects/mine", () => new HttpResponse(null, { status: 503 }))],
  loading: [
    http.get("*/api/projects/mine", async () => {
      await delay("infinite")
      return HttpResponse.json({})
    }),
  ],
}
