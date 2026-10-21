import type { MeOutputDto, MyProjectOutputDto } from "@caseai-connect/desk-contracts"
import { delay, HttpResponse, http } from "msw"
import { buildMe } from "../factories/account.factory"
import {
  buildDeskWorld,
  buildEmptyHistoryWorld,
  buildExtractionAgentWorld,
  buildNoAgentWorld,
  buildSeveralAgentsWorld,
  buildSeveralProjectsWorld,
  type DeskWorld,
} from "../factories/desk-world.factory"

const agentPath = "*/api/organizations/:organizationId/projects/:projectId/agents/:agentId"

/** `GET me`, answered with the given person. */
const meHandler = (me: MeOutputDto = buildMe()) =>
  http.get("*/api/me", () => HttpResponse.json({ data: me }))

/** `GET projects/mine`, answered with the given projects. */
const myProjectsHandler = (projects: MyProjectOutputDto[]) =>
  http.get("*/api/projects/mine", () => HttpResponse.json({ data: projects }))

/** The routes that read a world: projects, organizations, agents and each agent's history. */
export function worldHandlers(world: DeskWorld) {
  return [
    myProjectsHandler(world.projects),
    http.get("*/api/organizations/mine", () => HttpResponse.json({ data: world.organizations })),
    http.get("*/api/organizations/:organizationId/projects/:projectId/agents", ({ params }) =>
      HttpResponse.json({
        data: world.agents.filter((agent) => agent.projectId === params.projectId),
      }),
    ),
    http.post(`${agentPath}/conversation-agent-sessions/live`, ({ params }) =>
      HttpResponse.json({ data: world.conversations[String(params.agentId)] ?? [] }),
    ),
    http.post(`${agentPath}/extraction-agent-sessions/live`, ({ params }) =>
      HttpResponse.json({ data: world.extractionRuns[String(params.agentId)] ?? [] }),
    ),
    http.get(`${agentPath}/csv-extraction-runs/live`, ({ params }) =>
      HttpResponse.json({ data: world.csvExtractionRuns[String(params.agentId)] ?? [] }),
    ),
  ]
}

/** The API as the mock mode and the tests start from: one project, one agent. */
export const handlers = [meHandler(), ...worldHandlers(buildDeskWorld())]

/**
 * Other states of the screens, for the mock mode: `/app/?mock=agents`, `?mock=projects`,
 * `?mock=extraction`, `?mock=no-history`, `?mock=no-agent`, `?mock=error`, `?mock=loading`.
 */
export const mockScenarios = {
  agents: worldHandlers(buildSeveralAgentsWorld()),
  projects: worldHandlers(buildSeveralProjectsWorld()),
  extraction: worldHandlers(buildExtractionAgentWorld()),
  "no-history": worldHandlers(buildEmptyHistoryWorld()),
  "no-agent": worldHandlers(buildNoAgentWorld()),
  error: [http.get("*/api/projects/mine", () => new HttpResponse(null, { status: 503 }))],
  loading: [
    http.get("*/api/projects/mine", async () => {
      await delay("infinite")
      return HttpResponse.json({})
    }),
  ],
}
