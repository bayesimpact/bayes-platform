import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { extractionUrlsOf } from "@/test/desk-urls"
import { buildExtractionAgentWorld, type DeskWorld } from "@/test/factories/desk-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

/** A world with an extraction agent, served by the mocked API, which the test reads back. */
function serveExtractionWorld(): DeskWorld {
  const world = buildExtractionAgentWorld()
  server.use(...worldHandlers(world))
  return world
}

describe("the setup of a CSV file", () => {
  it("is set up, then started on the first rows only", async () => {
    const world = serveExtractionWorld()
    const { router } = renderApp(extractionUrlsOf(world).csvSetupUrl("articles.csv"))

    await screen.findByRole("heading", { name: "articles.csv" })
    for (const name of ["title", "author", "year", "abstract"]) {
      const group = screen.getByRole("group", { name: `What the agent does with ${name}` })
      await userEvent.click(within(group).getByRole("button", { name: "Skip" }))
    }
    expect(
      screen.getByText("Choose at least one column for the agent to read."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Extract every row" })).toBeDisabled()

    const title = screen.getByRole("group", { name: "What the agent does with title" })
    await userEvent.click(within(title).getByRole("button", { name: "Read" }))
    await userEvent.click(
      screen.getByRole("radio", { name: "The first rows only, to try the setup" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Extract the first 10 rows" }))

    expect(await screen.findByText(/of 10 rows/)).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/extraction\/csv-runs\//)
  })

  it("is not found for a file of someone else", async () => {
    const world = serveExtractionWorld()
    renderApp(`${extractionUrlsOf(world).newExtractionUrl}/csv/${crypto.randomUUID()}`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})
