import { EXTRACTION_MAX_BYTES } from "@caseai-connect/desk-contracts"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fileSizeOf } from "@/lib/file-size"
import { extractionUrlsOf } from "@/test/extraction-urls"
import { buildExtractionAgentWorld } from "@/test/factories/desk-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
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

const fileInput = () =>
  document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement

describe("a new extraction", () => {
  it("uploads a document, then opens its extraction while the agent reads it", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(extractionUrlsOf(world).newExtractionUrl)

    await screen.findByRole("heading", { name: "What should Document Reader read?" })
    await userEvent.upload(
      fileInput(),
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
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    renderApp(extractionUrlsOf(world).newExtractionUrl)

    await screen.findByRole("heading", { name: "What should Document Reader read?" })
    await userEvent.upload(fileInput(), new File(["slides"], "slides.pptx", { type: "" }), {
      applyAccept: false,
    })

    expect(
      await screen.findByText(
        "slides.pptx cannot be read. Give a PDF, a PNG or JPEG image, a text or a CSV file.",
      ),
    ).toBeInTheDocument()
  })

  it("extracts again a document uploaded before, and sets up a CSV file before it runs", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
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
