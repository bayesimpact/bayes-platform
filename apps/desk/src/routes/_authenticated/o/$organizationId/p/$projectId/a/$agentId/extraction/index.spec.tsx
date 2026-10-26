import { EXTRACTION_MAX_BYTES } from "@caseai-connect/desk-contracts"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { fileSizeOf } from "@/lib/file-size"
import { extractionUrlsOf } from "@/test/desk-urls"
import { buildExtractionAgentWorld, type DeskWorld } from "@/test/factories/desk-world.factory"
import { hiddenFileInput } from "@/test/file-input"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

/** A world with an extraction agent, served by the mocked API, which the test reads back. */
function serveExtractionWorld(): DeskWorld {
  const world = buildExtractionAgentWorld()
  server.use(...worldHandlers(world))
  return world
}

describe("a new extraction", () => {
  it("uploads a document, then opens its extraction while the agent reads it", async () => {
    const world = serveExtractionWorld()
    const { router } = renderApp(extractionUrlsOf(world).newExtractionUrl)

    await screen.findByRole("heading", { name: "What should Document Reader read?" })
    await userEvent.upload(
      hiddenFileInput(),
      new File(["%PDF-1.7"], "project-brief.pdf", { type: "application/pdf" }),
    )

    expect(await screen.findByRole("heading", { name: "project-brief.pdf" })).toBeInTheDocument()
    expect(screen.getByText("The agent is reading the document…")).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/extraction\/runs\//)
    expect(
      await screen.findByRole("link", { name: "project-brief.pdf In progress" }),
    ).toBeInTheDocument()
  })

  it("refuses a file it cannot read, and says why", async () => {
    const world = serveExtractionWorld()
    renderApp(extractionUrlsOf(world).newExtractionUrl)

    await screen.findByRole("heading", { name: "What should Document Reader read?" })
    await userEvent.upload(hiddenFileInput(), new File(["slides"], "slides.pptx", { type: "" }), {
      applyAccept: false,
    })

    expect(
      await screen.findByText(
        "slides.pptx cannot be read. Give a PDF, a PNG or JPEG image, a text or a CSV file.",
      ),
    ).toBeInTheDocument()
  })

  it("extracts again a document uploaded before, and sets up a CSV file before it runs", async () => {
    const world = serveExtractionWorld()
    const { router } = renderApp(extractionUrlsOf(world).newExtractionUrl)

    const documents = await screen.findByRole("region", { name: "Your documents" })
    await userEvent.click(
      within(documents).getByRole("button", { name: "Set up the extraction of articles.csv" }),
    )
    expect(await screen.findByRole("heading", { name: "articles.csv" })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/extraction\/csv\//)

    router.history.back()
    const again = await screen.findByRole("region", { name: "Your documents" })
    await userEvent.click(within(again).getByRole("button", { name: "Extract contract.pdf" }))
    expect(await screen.findByRole("heading", { name: "contract.pdf" })).toBeInTheDocument()
  })

  it("shows a document's details beside the page, and extracts it from there", async () => {
    const world = serveExtractionWorld()
    renderApp(extractionUrlsOf(world).newExtractionUrl)

    const documents = await screen.findByRole("region", { name: "Your documents" })
    await userEvent.click(
      within(documents).getByRole("button", { name: "Details of meeting-notes.md" }),
    )
    const panel = await screen.findByRole("complementary", { name: "meeting-notes.md" })

    expect(within(panel).getByText("text/markdown")).toBeInTheDocument()
    expect(within(panel).getByText("French")).toBeInTheDocument()
    expect(within(panel).getByRole("heading", { name: "Réunion d'équipe" })).toBeInTheDocument()
    expect(
      within(documents).getByRole("button", { name: "Details of meeting-notes.md" }),
    ).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(within(panel).getByRole("button", { name: "Extract" }))
    expect(await screen.findByRole("heading", { name: "meeting-notes.md" })).toBeInTheDocument()
  })

  it("says when the agent has read no text of a document yet", async () => {
    const world = serveExtractionWorld()
    renderApp(extractionUrlsOf(world).newExtractionUrl)

    const documents = await screen.findByRole("region", { name: "Your documents" })
    await userEvent.click(
      within(documents).getByRole("button", { name: "Details of contract.pdf" }),
    )
    const panel = await screen.findByRole("complementary", { name: "contract.pdf" })

    expect(
      within(panel).getByText("The agent reads the document's text in its first extraction."),
    ).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole("button", { name: "Close the panel" }))
    expect(screen.queryByRole("complementary", { name: "contract.pdf" })).not.toBeInTheDocument()
  })

  it("deletes a document uploaded before, after a confirmation", async () => {
    const world = serveExtractionWorld()
    renderApp(extractionUrlsOf(world).newExtractionUrl)

    const documents = await screen.findByRole("region", { name: "Your documents" })
    await userEvent.click(within(documents).getByRole("button", { name: "Delete contract.pdf" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this document?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("contract.pdf was deleted.")).toBeInTheDocument()
    expect(
      within(documents).queryByRole("button", { name: "Extract contract.pdf" }),
    ).not.toBeInTheDocument()
  })

  it("forgets a deleted CSV file, whose setup a step forward no longer shows", async () => {
    const world = serveExtractionWorld()
    const { router } = renderApp(extractionUrlsOf(world).newExtractionUrl)

    const documents = await screen.findByRole("region", { name: "Your documents" })
    await userEvent.click(
      within(documents).getByRole("button", { name: "Set up the extraction of articles.csv" }),
    )
    await screen.findByRole("heading", { name: "articles.csv" })
    router.history.back()
    const again = await screen.findByRole("region", { name: "Your documents" })
    await userEvent.click(within(again).getByRole("button", { name: "Delete articles.csv" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this document?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
    await screen.findByText("articles.csv was deleted.")

    router.history.forward()
    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})

describe("a file too large for an extraction", () => {
  it("is refused, with the limit the contracts set", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    renderApp(extractionUrlsOf(world).newExtractionUrl)
    const file = new File(["%PDF-1.7"], "archive.pdf", { type: "application/pdf" })
    Object.defineProperty(file, "size", { value: EXTRACTION_MAX_BYTES + 1 })

    await userEvent.upload(await screen.findByLabelText("File to extract"), file)

    const limit = fileSizeOf(EXTRACTION_MAX_BYTES, "en")
    expect(await screen.findByText(`archive.pdf is larger than ${limit}.`)).toBeInTheDocument()
    expect(
      screen.getByText(`PDF, image, text or CSV file, up to ${limit}.`, { exact: false }),
    ).toBeInTheDocument()
  })
})
