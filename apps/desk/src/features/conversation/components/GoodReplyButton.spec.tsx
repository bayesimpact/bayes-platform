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
import { GoodReplyButton } from "./GoodReplyButton"

function renderButton() {
  const queryClient = createQueryClient({ isRetrying: false })
  const conversation = {
    organizationId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    agentId: crypto.randomUUID(),
    agentSessionId: crypto.randomUUID(),
  }
  renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <GoodReplyButton conversation={conversation} agentMessageId={crypto.randomUUID()} />
      <Toaster />
    </QueryClientProvider>,
  )
}

describe("GoodReplyButton", () => {
  it("sends the thumbs-up, says so and stays pressed", async () => {
    let sentBody: unknown = null
    server.use(
      mockRoute(DeskConversationsRoutes.createMessageFeedback, ({ payload }) => {
        sentBody = payload
        return { success: true }
      }),
    )
    renderButton()

    await userEvent.click(screen.getByRole("button", { name: "Good reply" }))

    expect(await screen.findByText("Thank you for your feedback.")).toBeInTheDocument()
    expect(sentBody).toEqual({ rating: "positive" })
    const button = screen.getByRole("button", { name: "Good reply" })
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toBeDisabled()
  })

  it("says the thumbs-up failed, and offers it again", async () => {
    server.use(mockRoute(DeskConversationsRoutes.createMessageFeedback, () => apiError(500)))
    renderButton()

    await userEvent.click(screen.getByRole("button", { name: "Good reply" }))

    expect(
      await screen.findByText("Your feedback could not be sent. Try again."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Good reply" })).toBeEnabled()
  })
})
