import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { activateLocale } from "@/app/i18n"
import {
  buildDeskWorld,
  buildNoAgentWorld,
  buildSeveralAgentsWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/desk-world.factory"
import { meHandlers, termsHandlers, worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession: async () => true,
  getAccessToken: async () => "test-token",
}))

beforeEach(() => {
  window.localStorage.clear()
})

describe("the Desk's home", () => {
  it("opens a new conversation with the only agent, with its history and no switcher", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    const [assistant] = world.agents
    const { router } = renderApp("/app/")

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Message to Helpful Assistant" })).toHaveFocus()
    expect(router.state.location.pathname).toBe(
      `/o/${world.organizations[0]?.id}/p/${assistant?.projectId}/a/${assistant?.id}`,
    )
    expect(screen.queryByRole("combobox", { name: /Switch agent/ })).not.toBeInTheDocument()
    // The sidebar names the agent, as the switcher would, and the bar above the page does too.
    expect(screen.getAllByText("Helpful Assistant")).toHaveLength(2)
    expect(await screen.findByRole("link", { name: "Compare the plans" })).toBeInTheDocument()
    expect(screen.getByText("Today")).toBeInTheDocument()
    expect(screen.getByText("Yesterday")).toBeInTheDocument()
  })

  it("lets a person with several agents switch agent", async () => {
    server.use(...worldHandlers(buildSeveralAgentsWorld()))
    renderApp("/app/")

    const switcher = await screen.findByRole("combobox", {
      name: "Switch agent, current agent: Document Reader",
    })
    await userEvent.click(switcher)
    const list = await screen.findByRole("listbox")
    expect(
      within(list)
        .getAllByRole("option")
        .map((item) => item.textContent),
    ).toEqual(["Document Reader", "Helpful Assistant", "Writing Helper"])
    expect(screen.getByRole("combobox", { name: "Search an agent" })).toHaveFocus()

    await userEvent.click(within(list).getByRole("option", { name: "Helpful Assistant" }))

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Compare the plans" })).toBeInTheDocument()
  })

  it("groups the agents by project when the person has several projects", async () => {
    server.use(...worldHandlers(buildSeveralProjectsWorld()))
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("combobox", { name: /Switch agent/ }))
    const list = await screen.findByRole("listbox")

    expect(
      within(list)
        .getAllByRole("group")
        .map((group) => group.firstChild?.textContent),
    ).toEqual(["Help center · Operations", "Pricing · Product", "Support · Product"])
  })

  it("finds an agent by its name or its project's in the switcher", async () => {
    server.use(...worldHandlers(buildSeveralProjectsWorld()))
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("combobox", { name: /Switch agent/ }))
    const search = await screen.findByRole("combobox", { name: "Search an agent" })
    const optionNames = () =>
      within(screen.getByRole("listbox"))
        .queryAllByRole("option")
        .map((option) => option.textContent)

    await userEvent.type(search, "help center")
    expect(optionNames().length).toBeGreaterThan(0)
    expect(
      within(screen.getByRole("listbox"))
        .getAllByRole("group")
        .map((group) => group.firstChild?.textContent),
    ).toEqual(["Help center · Operations"])

    await userEvent.clear(search)
    await userEvent.type(search, "nothing like this")
    expect(optionNames()).toEqual([])
    expect(screen.getByText("No agent matches this search.")).toBeInTheDocument()
  })

  it("opens the agent the person used last", async () => {
    const world = buildSeveralAgentsWorld()
    server.use(...worldHandlers(world))
    const writer = world.agents.find((agent) => agent.name === "Writing Helper")
    window.localStorage.setItem("desk.lastAgentId", writer?.id ?? "")
    renderApp("/app/")

    expect(
      await screen.findByRole("combobox", { name: "Switch agent, current agent: Writing Helper" }),
    ).toBeInTheDocument()
  })

  it("says so when the person has no agent yet", async () => {
    server.use(...worldHandlers(buildNoAgentWorld()))
    renderApp("/app/")

    expect(await screen.findByText("You don't have access to an agent yet")).toBeInTheDocument()
  })

  it("offers to try again when the projects could not load, and loads them", async () => {
    server.use(
      http.get("*/api/projects/mine", () => new HttpResponse(null, { status: 503 }), {
        once: true,
      }),
    )
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
  })

  it("offers to reload when the API answers another version of the contract", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(http.get("*/api/projects/mine", () => HttpResponse.json({ data: [{ id: "x" }] })))
    renderApp("/app/")

    expect(await screen.findByRole("button", { name: "Reload" })).toBeInTheDocument()
  })

  it("shows in French", async () => {
    await activateLocale("fr")
    renderApp("/app/")

    expect(
      await screen.findByRole("heading", { name: "Comment puis-je vous aider aujourd'hui ?" }),
    ).toBeInTheDocument()
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
})

describe("the terms", () => {
  it("come before the Desk, which opens once the required ones are accepted", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world), ...termsHandlers())
    renderApp("/app/")

    expect(await screen.findByRole("heading", { name: "Before you start" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "How can I help you today?" }),
    ).not.toBeInTheDocument()
    const submit = screen.getByRole("button", { name: "Accept and continue" })
    expect(submit).toBeDisabled()

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "I accept the general conditions of service (required)",
      }),
    )
    expect(submit).toBeDisabled()
    await userEvent.click(
      screen.getByRole("checkbox", { name: "I accept the privacy policy (required)" }),
    )
    expect(screen.getByRole("link", { name: /Read the privacy policy/ })).toHaveAttribute(
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
    // A person of their own: the rename must not reach the other tests.
    server.use(...worldHandlers(buildDeskWorld()), ...meHandlers())
    renderApp("/app/")

    await userEvent.click(
      await screen.findByRole("button", { name: "Open the menu of alex@example.org" }),
    )
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
    expect(
      screen.getByRole("button", { name: "Open the menu of alex@example.org" }),
    ).toHaveTextContent("Sam Example")
  })
})
