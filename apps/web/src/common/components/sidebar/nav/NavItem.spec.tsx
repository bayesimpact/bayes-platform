import { AgentModel } from "@caseai-connect/api-contracts"
import { SidebarProvider } from "@caseai-connect/ui/shad/sidebar"
import { configureStore } from "@reduxjs/toolkit"
import { renderToStaticMarkup } from "react-dom/server"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { agentFactory, agentModelsCatalogFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { ADS } from "@/common/store/async-data-status"
import { isStudioInterface } from "@/studio/routes/helpers"
import { AppNavItem } from "./NavItem"

// `isStudioInterface` reads `window.location`, which does not exist under vitest's node environment.
vi.mock("@/studio/routes/helpers", () => ({ isStudioInterface: vi.fn() }))

const DEPRECATED_ICON_CLASS = "text-orange-500"

const project = projectFactory.transient({ organization: organizationFactory.build() }).build()
const agent = agentFactory.transient({ project }).build()

/** A store holding only the slices the icon reads, with an agent on a deprecated model. */
function buildStore() {
  const agentSettings = agentSettingsFactory
    .transient({ agent })
    .build({ model: AgentModel.Gemini25Flash, revision: agent.currentRevision?.number ?? 1 })
  const state = {
    agents: {
      data: { status: ADS.Fulfilled, error: null, value: [agent] },
      availableModels: {
        status: ADS.Fulfilled,
        error: null,
        value: agentModelsCatalogFactory.build(),
      },
    },
    agentSettings: {
      history: { [agent.id]: { status: ADS.Fulfilled, error: null, value: [agentSettings] } },
      playgroundRevisionByAgentId: {},
    },
  }
  return configureStore({ reducer: () => state })
}

function renderNavItem() {
  return renderToStaticMarkup(
    <Provider store={buildStore()}>
      <MemoryRouter>
        <SidebarProvider>
          <AppNavItem item={{ id: agent.id, title: agent.name, url: "/agent" }} />
        </SidebarProvider>
      </MemoryRouter>
    </Provider>,
  )
}

describe("AppNavItem", () => {
  // The tooltip formats the deprecation date in the UI language, read from `localStorage`.
  beforeEach(() => {
    vi.mocked(isStudioInterface).mockReset()
    vi.stubGlobal("localStorage", { getItem: () => "en" })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("marks an agent on a deprecated model in Studio", () => {
    vi.mocked(isStudioInterface).mockReturnValue(true)

    expect(renderNavItem()).toContain(DEPRECATED_ICON_CLASS)
  })

  it("does not mark it outside Studio, where the model cannot be changed", () => {
    vi.mocked(isStudioInterface).mockReturnValue(false)

    const markup = renderNavItem()

    expect(markup).toContain(agent.name)
    expect(markup).not.toContain(DEPRECATED_ICON_CLASS)
  })
})
