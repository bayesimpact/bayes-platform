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

// No DOM under vitest: the button hands over its click handler so a test can call it.
let clickButton: ((event: unknown) => void) | undefined
vi.mock("@caseai-connect/ui/shad/button", () => ({
  Button: ({ onClick }: { onClick: (event: unknown) => void }) => {
    clickButton = onClick
    return null
  },
}))

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()
const agent = agentFactory.transient({ project }).build({ type: "conversation" })
const ids = { agentId: agent.id, projectId: project.id, organizationId: organization.id }

/** The slices every app registers: Desk has no `agentSettings` slice. */
const deskState = {
  projects: { data: { status: ADS.Fulfilled, error: null, value: [project] } },
  currentIds: { organizationId: organization.id, projectId: project.id },
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

function renderCreator(
  state: object,
  { type = "menu", createOne = vi.fn() }: { type?: "button" | "menu"; createOne?: () => void } = {},
) {
  const store = configureStore({
    reducer: () => state,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: { services: { conversationAgentSessions: { createOne } } } },
        serializableCheck: false,
      }),
  })
  return renderToStaticMarkup(
    <Provider store={store}>
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
            <BaseAgentSessionCreator agentType="conversation" type={type} ids={ids} />
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

  it("creates a Desk session without passing the click event on as variables", async () => {
    vi.mocked(isStudioInterface).mockReturnValue(false)
    const createOne = vi.fn().mockResolvedValue({ id: "new-session" })
    renderCreator(deskState, { type: "button", createOne })

    clickButton?.({ type: "click" })

    await vi.waitFor(() => expect(createOne).toHaveBeenCalled())
    expect(createOne).toHaveBeenCalledWith(expect.objectContaining({ variables: undefined }))
  })

  it("renders in the Studio playground, which reads the tested agent settings", () => {
    vi.mocked(isStudioInterface).mockReturnValue(true)

    expect(renderCreator(studioState)).toContain("conversationAgentSession:create.button")
  })
})
