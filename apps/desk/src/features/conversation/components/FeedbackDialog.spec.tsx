import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { describe, expect, it, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { server } from "@/test/msw/server"
import { renderWithI18n } from "@/test/render-with-i18n"
import { FeedbackDialog } from "./FeedbackDialog"

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession: async () => true,
  getAccessToken: async () => "test-token",
}))

const feedbackPath =
  "*/api/organizations/:organizationId/projects/:projectId/agent-messages/:agentMessageId/feedbacks"

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const conversation = {
    organizationId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    agentId: crypto.randomUUID(),
    agentSessionId: crypto.randomUUID(),
  }
  renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <FeedbackDialog conversation={conversation} agentMessageId={crypto.randomUUID()} />
      <Toaster />
    </QueryClientProvider>,
  )
}

async function sendReport(content: string) {
  await userEvent.click(screen.getByRole("button", { name: "Report a problem" }))
  await userEvent.type(await screen.findByLabelText("What went wrong?"), content)
  await userEvent.click(screen.getByRole("button", { name: "Send the report" }))
}

describe("FeedbackDialog", () => {
  it("sends the report, says so and closes", async () => {
    server.use(
      http.post(feedbackPath, () =>
        HttpResponse.json({ data: { success: true } }, { status: 201 }),
      ),
    )
    renderDialog()

    await sendReport("The prices are out of date.")

    expect(await screen.findByText("Thank you. Your report was sent.")).toBeInTheDocument()
    expect(screen.queryByLabelText("What went wrong?")).not.toBeInTheDocument()
  })

  it("says the report failed, and keeps it to send again", async () => {
    server.use(http.post(feedbackPath, () => HttpResponse.json({}, { status: 500 })))
    renderDialog()

    await sendReport("The prices are out of date.")

    expect(await screen.findByText("The report could not be sent. Try again.")).toBeInTheDocument()
    expect(screen.getByLabelText("What went wrong?")).toHaveValue("The prices are out of date.")
    expect(screen.getByRole("button", { name: "Send the report" })).toBeEnabled()
  })

  it("names the longest report the contract allows", async () => {
    renderDialog()

    await sendReport(" ")

    expect(
      await screen.findByText("Describe the problem in a few words, up to 2,000 characters."),
    ).toBeInTheDocument()
  })
})
