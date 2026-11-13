import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { randomConversationParams, renderWithQueryClient } from "@/test/render-with-query-client"
import { GoodReplyButton } from "./GoodReplyButton"

function renderButton() {
  renderWithQueryClient(
    <GoodReplyButton
      conversation={randomConversationParams()}
      agentMessageId={crypto.randomUUID()}
    />,
  )
}

describe("GoodReplyButton", () => {
  it("sends the thumbs-up once, says so and stays pressed and focusable", async () => {
    const sentBodies: unknown[] = []
    server.use(
      mockRoute(DeskConversationsRoutes.createMessageFeedback, ({ payload }) => {
        sentBodies.push(payload)
        return { success: true }
      }),
    )
    renderButton()
    const button = screen.getByRole("button", { name: "Good reply" })

    await userEvent.click(button)
    expect(await screen.findByText("Thank you for your feedback.")).toBeInTheDocument()
    await userEvent.click(button)

    expect(sentBodies).toEqual([{ rating: "positive" }])
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toBeEnabled()
  })

  it("says the thumbs-up failed, and offers it again", async () => {
    server.use(mockRoute(DeskConversationsRoutes.createMessageFeedback, () => apiError(500)))
    renderButton()

    await userEvent.click(screen.getByRole("button", { name: "Good reply" }))

    expect(
      await screen.findByText("Your feedback could not be sent. Try again."),
    ).toBeInTheDocument()
    const button = screen.getByRole("button", { name: "Good reply" })
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).toBeEnabled()
  })
})
