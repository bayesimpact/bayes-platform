import { DeskAccountRoutes, DeskProjectsRoutes } from "@caseai-connect/desk-contracts"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"
import { activateLocale, detectLocale } from "@/app/i18n"
import { rememberLastAgent } from "@/features/agents"
import { isApplePlatform } from "@/lib/platform"
import { agentOf, agentUrlOf, routerPathOf } from "@/test/desk-urls"
import {
  buildDeskWorld,
  buildNoAgentWorld,
  buildOnlyReadOnlyAgentsWorld,
  buildReadOnlyAgentWorld,
  buildSeveralAgentsWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/desk-world.factory"
import { termsHandlers, worldHandlers } from "@/test/msw/handlers"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

/**
 * Checks the groups of the command center's list, each named by its project, its organization and
 * its type of agent, in their order on screen.
 */
async function expectSwitcherGroups(names: string[]) {
  const list = await screen.findByRole("listbox")
  expect(within(list).getAllByRole("group")).toEqual(
    names.map((name) => within(list).getByRole("group", { name })),
  )
}

/** Checks the agents of the command center's list, by their accessible names, in their order. */
async function expectSwitcherOptions(names: string[]) {
  const list = await screen.findByRole("listbox")
  expect(within(list).queryAllByRole("option")).toEqual(
    names.map((name) => within(list).getByRole("option", { name })),
  )
}

/** The shortcut that opens the command center: ⌘K on an Apple system, Ctrl+K elsewhere. */
const commandCenterShortcut = isApplePlatform() ? "{Meta>}k{/Meta}" : "{Control>}k{/Control}"

describe("the Desk's home", () => {
  it("opens a new conversation with the only agent, with its history and no switcher", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp("/app/")

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
    // The editor of the message box takes the focus once it is set up.
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Message to Helpful Assistant" })).toHaveFocus(),
    )
    expect(router.state.location.pathname).toBe(routerPathOf(agentUrlOf(world)))
    expect(screen.queryByRole("button", { name: /Switch agent/ })).not.toBeInTheDocument()
    // With nothing to switch to, the shortcut opens no command center.
    await userEvent.keyboard(commandCenterShortcut)
    expect(screen.queryByRole("dialog", { name: "Switch agent" })).not.toBeInTheDocument()
    // The open sidebar names the agent, as the switcher would: the bar above the page does not.
    expect(screen.getAllByText("Helpful Assistant")).toHaveLength(1)
    expect(await screen.findByRole("link", { name: "Compare the plans" })).toBeInTheDocument()
    expect(screen.getByText("Today")).toBeInTheDocument()

    // Once the sidebar is hidden, the bar names the agent.
    await userEvent.click(screen.getByRole("button", { name: "Hide the sidebar" }))
    expect(await screen.findByRole("button", { name: "Show the sidebar" })).toBeInTheDocument()
    expect(screen.getAllByText("Helpful Assistant")).toHaveLength(2)
    expect(screen.getByText("Yesterday")).toBeInTheDocument()
  })

  it("lets a person with several agents switch agent in the command center", async () => {
    server.use(...worldHandlers(buildSeveralAgentsWorld()))
    renderApp("/app/")

    const switcher = await screen.findByRole("button", {
      name: "Switch agent, current agent: Document Reader",
    })
    await userEvent.click(switcher)
    const dialog = await screen.findByRole("dialog", { name: "Switch agent" })
    // Conversation agents come first, the current agent is marked.
    await expectSwitcherOptions(["Helpful Assistant", "Writing Helper", "Document Reader Current"])
    await expectSwitcherGroups(["Conversation agents", "Extraction agents"])
    expect(within(dialog).getByRole("combobox", { name: "Search an agent" })).toHaveFocus()

    await userEvent.click(within(dialog).getByRole("option", { name: "Helpful Assistant" }))

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Switch agent" })).not.toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Compare the plans" })).toBeInTheDocument()
  })

  it("opens the command center with the shortcut, and Enter opens the agent chosen with the arrows", async () => {
    server.use(...worldHandlers(buildSeveralAgentsWorld()))
    renderApp("/app/")
    await screen.findByRole("button", { name: /Switch agent/ })

    await userEvent.keyboard(commandCenterShortcut)
    await screen.findByRole("dialog", { name: "Switch agent" })
    await userEvent.keyboard("{ArrowDown}{Enter}")

    expect(
      await screen.findByRole("button", { name: "Switch agent, current agent: Writing Helper" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Switch agent" })).not.toBeInTheDocument()

    // The shortcut closes it too.
    await userEvent.keyboard(commandCenterShortcut)
    await screen.findByRole("dialog", { name: "Switch agent" })
    await userEvent.keyboard(commandCenterShortcut)
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Switch agent" })).not.toBeInTheDocument(),
    )
  })

  it("leaves out of the switcher an agent the person may read but not open a session with", async () => {
    server.use(...worldHandlers(buildReadOnlyAgentWorld()))
    renderApp("/app/")

    await userEvent.click(
      await screen.findByRole("button", { name: "Switch agent, current agent: Document Reader" }),
    )
    await expectSwitcherOptions(["Helpful Assistant", "Document Reader Current"])
  })

  it("groups the agents by project, then by type, when the person has several projects", async () => {
    server.use(...worldHandlers(buildSeveralProjectsWorld()))
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: /Switch agent/ }))

    await expectSwitcherGroups([
      "Help center · Operations · Conversation agents",
      "Pricing · Product · Conversation agents",
      "Support · Product · Conversation agents",
      "Support · Product · Extraction agents",
    ])
  })

  it("finds an agent by every word of its names in the command center", async () => {
    server.use(...worldHandlers(buildSeveralProjectsWorld()))
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: /Switch agent/ }))
    const dialog = await screen.findByRole("dialog", { name: "Switch agent" })
    const search = within(dialog).getByRole("combobox", { name: "Search an agent" })

    // "reader" is in the agent's name, "support" in its project's.
    await userEvent.type(search, "support reader")
    await expectSwitcherOptions(["Document Reader"])
    await expectSwitcherGroups(["Support · Product · Extraction agents"])

    await userEvent.clear(search)
    await userEvent.type(search, "operations")
    await expectSwitcherOptions(["Help Center Guide Current"])

    await userEvent.clear(search)
    await userEvent.type(search, "nothing like this")
    await expectSwitcherOptions([])
    expect(within(dialog).getByText("No agent matches this search.")).toBeInTheDocument()
  })

  it("opens the agent the person used last", async () => {
    const world = buildSeveralAgentsWorld()
    server.use(...worldHandlers(world))
    rememberLastAgent(agentOf(world, "Writing Helper").id)
    renderApp("/app/")

    expect(
      await screen.findByRole("button", { name: "Switch agent, current agent: Writing Helper" }),
    ).toBeInTheDocument()
  })

  it("says so when the person has no agent yet", async () => {
    server.use(...worldHandlers(buildNoAgentWorld()))
    renderApp("/app/")

    expect(await screen.findByText("You don't have access to an agent yet")).toBeInTheDocument()
  })

  it("says so to a person who only reads the agents of their project", async () => {
    server.use(...worldHandlers(buildOnlyReadOnlyAgentsWorld()))
    renderApp("/app/")

    expect(await screen.findByText("You don't have access to an agent yet")).toBeInTheDocument()
  })

  it("offers to try again when the projects could not load, and loads them", async () => {
    server.use(mockRoute(DeskProjectsRoutes.getAllMine, () => apiError(503), { once: true }))
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
  })

  it("offers to reload when the API answers another version of the contract", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    // A project without its fields, which the schema refuses: sent as is, past the contract.
    server.use(
      mockRoute(DeskProjectsRoutes.getAllMine, () =>
        HttpResponse.json({ data: [{ id: crypto.randomUUID() }] }),
      ),
    )
    renderApp("/app/")

    expect(await screen.findByRole("button", { name: "Reload" })).toBeInTheDocument()
  })

  it.each([
    ["fr", "Comment puis-je vous aider aujourd'hui ?"],
    ["de", "Wie kann ich Ihnen heute helfen?"],
    ["it", "Come posso aiutarti oggi?"],
    ["es", "¿En qué puedo ayudarle hoy?"],
    ["pl", "W czym mogę Ci dziś pomóc?"],
  ] as const)("shows in its other languages (%s)", async (locale, heading) => {
    await activateLocale(locale)
    renderApp("/app/")

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument()
  })

  it("switches to the language the person chooses, and keeps it for the next visit", async () => {
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: /menu of alex@example\.org$/ }))
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Français" }))

    expect(
      await screen.findByRole("heading", { name: "Comment puis-je vous aider aujourd'hui ?" }),
    ).toBeInTheDocument()
    expect(detectLocale()).toBe("fr")
  })

  it("offers its languages in the user menu, each in its own name", async () => {
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: /menu of alex@example\.org$/ }))

    const languages = await screen.findAllByRole("menuitemradio")
    expect(languages.map((language) => language.textContent)).toEqual([
      "English",
      "Français",
      "Deutsch",
      "Italiano",
      "Español",
      "Polski",
    ])
  })

  it("opens in the first of the browser's languages it speaks", () => {
    const browserLanguages = vi.spyOn(navigator, "languages", "get")
    browserLanguages.mockReturnValue(["nl-NL", "pl-PL", "en-US"])

    expect(detectLocale()).toBe("pl")

    browserLanguages.mockRestore()
  })

  it("is where an organization's URL leads", async () => {
    renderApp(`/app/o/${crypto.randomUUID()}`)

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
  })

  it("leads back from a page that does not exist", async () => {
    renderApp("/app/no-such-page")

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to the Desk" })).toHaveAttribute("href", "/app/")
  })
})

describe("the invitations", () => {
  it("open from the envelope of the sidebar, and an accepted one opens its agent", async () => {
    const world = buildNoAgentWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: "1 pending invitation" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Release Notes Writer")).toBeInTheDocument()
    expect(within(dialog).getByText(/Agent · Support · Product/)).toBeInTheDocument()

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Accept the invitation to Release Notes Writer" }),
    )

    expect(await screen.findByText("You joined Release Notes Writer.")).toBeInTheDocument()
    expect(
      await screen.findByRole("textbox", { name: "Message to Release Notes Writer" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/a\//)
    // Without an invitation left, the envelope goes.
    expect(screen.queryByRole("button", { name: /pending invitation/ })).not.toBeInTheDocument()
  })

  it("can be declined, which leaves the person without the agent", async () => {
    const world = buildNoAgentWorld()
    server.use(...worldHandlers(world))
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: "1 pending invitation" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Decline the invitation to Release Notes Writer",
      }),
    )

    expect(
      await screen.findByText("You declined the invitation to Release Notes Writer."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /pending invitation/ })).not.toBeInTheDocument()
    expect(screen.getByText("You don't have access to an agent yet")).toBeInTheDocument()
    expect(world.agents).toEqual([])
  })
})

describe("the terms", () => {
  it("come before the Desk, which opens once the required ones are accepted", async () => {
    server.use(...termsHandlers())
    renderApp("/app/")

    expect(await screen.findByRole("heading", { name: "Before you start" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "How can I help you today?" }),
    ).not.toBeInTheDocument()
    const submit = screen.getByRole("button", { name: "Accept and continue" })

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "I accept the general conditions of service (required)",
      }),
    )
    await userEvent.click(
      screen.getByRole("checkbox", { name: "I accept the privacy policy (required)" }),
    )
    expect(screen.getByRole("link", { name: /^Read it.*the privacy policy/ })).toHaveAttribute(
      "href",
      "https://example.org/terms/privacy-policy",
    )
    await userEvent.click(submit)

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
  })
})

describe("the person's name", () => {
  it("is edited from the user menu, and shows at once", async () => {
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: /menu of alex@example\.org$/ }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit your name" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit your name" })
    const nameField = within(dialog).getByRole("textbox", { name: "Name" })
    expect(nameField).toHaveValue("Alex Example")

    await userEvent.clear(nameField)
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    expect(
      await within(dialog).findByText("Write a name of 1 to 100 characters."),
    ).toBeInTheDocument()

    await userEvent.type(nameField, "  Sam Example ")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Your name was saved.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /menu of alex@example\.org$/ })).toHaveTextContent(
      "Sam Example",
    )
  })
})

describe("the terms left unchecked", () => {
  it("say which ones are required when the person sends the form", async () => {
    server.use(...worldHandlers(buildDeskWorld()), ...termsHandlers())
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: "Accept and continue" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Accept the general conditions and the privacy policy to continue.",
    )
    expect(
      screen.getByRole("checkbox", { name: "I accept the privacy policy (required)" }),
    ).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("heading", { name: "Before you start" })).toBeInTheDocument()
  })
})

describe("a name the API does not save", () => {
  it("says so in a toast, and keeps the dialog open to try again", async () => {
    server.use(mockRoute(DeskAccountRoutes.patchMe, () => apiError(500)))
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: /menu of alex@example\.org$/ }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit your name" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit your name" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Your name could not be saved. Try again.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled()
  })
})
