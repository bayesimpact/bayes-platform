import { SidebarProvider } from "@caseai-connect/ui/shad/sidebar"
import { configureStore } from "@reduxjs/toolkit"
import { renderToStaticMarkup } from "react-dom/server"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { RoutesBuilderProvider } from "@/common/routes/build-routes/RoutesBuilderProvider"
import { ADS } from "@/common/store/async-data-status"
import { DeskRoutes } from "@/desk/routes/helpers"
import { isStudioInterface } from "@/studio/routes/helpers"
import { BaseAgentSessionCreator } from "./BaseAgentSessionCreator"

// `isStudioInterface` reads `window.location`, which does not exist under vitest's node environment.
vi.mock("@/studio/routes/helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/studio/routes/helpers")>()),
  isStudioInterface: vi.fn(),
}))

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()
const agent = agentFactory.transient({ project }).build({ type: "conversation" })
const ids = { agentId: agent.id, projectId: project.id, organizationId: organization.id }

/** The slices every app registers: Desk has no `agentSettings` slice. */
const deskState = {
  projects: { data: { status: ADS.Fulfilled, error: null, value: [project] } },
  currentIds: { projectId: project.id },
}

const studioState = {
  ...deskState,
  agentSettings: {
    history: {
      [agent.id]: {
        status: ADS.Fulfilled,
        error: null,
        value: [agentSettingsFactory.transient({ agent }).build()],
      },
    },
    playgroundRevisionByAgentId: {},
  },
}

function renderCreator(state: object) {
  return renderToStaticMarkup(
    <Provider store={configureStore({ reducer: () => state })}>
      <MemoryRouter>
        <RoutesBuilderProvider
          build={{
            projectRoute: DeskRoutes.project.build,
            agentRoute: DeskRoutes.agent.build,
            agentSessionRoute: DeskRoutes.agentSession.build,
            agentExtractionCsvRunRoute: DeskRoutes.agentExtractionCsvRun.build,
            agentExtractionRunRoute: DeskRoutes.agentExtractionRun.build,
          }}
        >
          <SidebarProvider>
            <BaseAgentSessionCreator agentType="conversation" type="menu" ids={ids} />
          </SidebarProvider>
        </RoutesBuilderProvider>
      </MemoryRouter>
    </Provider>,
  )
}

describe("BaseAgentSessionCreator", () => {
  beforeEach(() => vi.mocked(isStudioInterface).mockReset())

  it("renders in Desk, whose store has no agent settings", () => {
    vi.mocked(isStudioInterface).mockReturnValue(false)

    expect(renderCreator(deskState)).toContain("conversationAgentSession:create.button")
  })

  it("renders in the Studio playground, which reads the tested agent settings", () => {
    vi.mocked(isStudioInterface).mockReturnValue(true)

    expect(renderCreator(studioState)).toContain("conversationAgentSession:create.button")
  })
})
