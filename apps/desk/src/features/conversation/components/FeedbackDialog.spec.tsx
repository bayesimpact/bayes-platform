import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { QueryClientProvider } from "@tanstack/react-query"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { createQueryClient } from "@/app/query-client"
import { Toaster } from "@/components/ui/sonner"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderWithI18n } from "@/test/render-with-i18n"
import { FeedbackDialog } from "./FeedbackDialog"

function renderDialog() {
  const queryClient = createQueryClient({ isRetrying: false })
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
    server.use(mockRoute(DeskConversationsRoutes.createMessageFeedback, () => ({ success: true })))
    renderDialog()

    await sendReport("The prices are out of date.")

    expect(await screen.findByText("Thank you. Your report was sent.")).toBeInTheDocument()
    expect(screen.queryByLabelText("What went wrong?")).not.toBeInTheDocument()
  })

  it("says the report failed, and keeps it to send again", async () => {
    server.use(mockRoute(DeskConversationsRoutes.createMessageFeedback, () => apiError(500)))
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
