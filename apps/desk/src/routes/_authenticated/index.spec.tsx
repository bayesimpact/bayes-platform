import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { describe, expect, it, vi } from "vitest"
import { activateLocale } from "@/app/i18n"
import { buildMe } from "@/test/factories/account.factory"
import { meHandler } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession: async () => true,
  getAccessToken: async () => "test-token",
}))

describe("the Desk's home", () => {
  it("lists the person's projects, grouped by organization", async () => {
    renderApp("/app/")

    expect(await screen.findByRole("heading", { name: "Your projects" })).toBeInTheDocument()
    expect(screen.getByText("3 projects")).toBeInTheDocument()
    const product = screen.getByRole("region", { name: "Product" })
    expect(
      within(product)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Pricing", "Support"])
    expect(screen.getByRole("region", { name: "Operations" })).toHaveTextContent("Help center")
  })

  it("says so when the person has no project yet", async () => {
    server.use(meHandler(buildMe({ projects: [] })))
    renderApp("/app/")

    expect(await screen.findByText("No project yet")).toBeInTheDocument()
    expect(screen.queryByText(/^\d+ projects?$/)).not.toBeInTheDocument()
  })

  it("offers to try again when the projects could not load, and loads them", async () => {
    server.use(
      http.get("*/api/desk/me", () => new HttpResponse(null, { status: 503 }), { once: true }),
    )
    renderApp("/app/")

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(await screen.findByRole("heading", { name: "Your projects" })).toBeInTheDocument()
  })

  it("offers to reload when the API answers another version of the contract", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(http.get("*/api/desk/me", () => HttpResponse.json({ data: { user: {} } })))
    renderApp("/app/")

    expect(await screen.findByRole("button", { name: "Reload" })).toBeInTheDocument()
  })

  it("shows in French", async () => {
    await activateLocale("fr")
    renderApp("/app/")

    expect(await screen.findByRole("heading", { name: "Vos projets" })).toBeInTheDocument()
    expect(screen.getByText("3 projets")).toBeInTheDocument()
  })

  it("is where an organization's URL leads", async () => {
    const { router } = renderApp(`/app/o/${crypto.randomUUID()}`)

    expect(await screen.findByRole("heading", { name: "Your projects" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/")
  })

  it("leads back from a page that does not exist", async () => {
    renderApp("/app/no-such-page")

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to your projects" })).toHaveAttribute(
      "href",
      "/app/",
    )
  })
})
