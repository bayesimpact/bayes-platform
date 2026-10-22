import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
import { conversationUrlOf } from "@/test/desk-urls"
import { buildEmptyHistoryWorld } from "@/test/factories/desk-world.factory"
import { mockStreamRoute } from "@/test/msw/mock-route"
import { desk } from "@/test/msw/story-api"
import { deskMeta } from "./desk-meta"

/** The conversations with an agent: a new one, one under way, and a reply that fails. */
const meta = {
  title: "Desk/Conversation",
  ...deskMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Conversation: Story = {
  parameters: desk({ url: (world) => conversationUrlOf(world) }),
}

export const FirstConversation: Story = {
  parameters: desk({ world: buildEmptyHistoryWorld }),
}

/**
 * The agent fails its reply to the message the story sends, with the server's reason, and
 * answers the retry.
 */
export const ReplyFails: Story = {
  parameters: desk({
    url: (world) => conversationUrlOf(world),
    handlers: () => [
      mockStreamRoute(
        DeskConversationsRoutes.streamReply,
        () => [{ thrownError: "The model is overloaded" }],
        { once: true },
      ),
    ],
  }),
  // A reply fails only once the person sent a message: the story sends one, in either language.
  play: async ({ canvasElement }) => {
    const composer = await within(canvasElement).findByRole(
      "textbox",
      { name: /Helpful Assistant/ },
      { timeout: 5000 },
    )
    await userEvent.type(composer, "Hello{Enter}")
  },
}
