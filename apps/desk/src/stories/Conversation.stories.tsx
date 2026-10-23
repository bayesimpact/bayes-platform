import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
import { conversationUrlOf } from "@/test/desk-urls"
import {
  buildEmptyHistoryWorld,
  buildLongConversationWorld,
  buildQuotedMessageWorld,
} from "@/test/factories/desk-world.factory"
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

/** The person quoted passages of a reply in their message: they show as chips. */
export const QuotedMessage: Story = {
  parameters: desk({
    world: buildQuotedMessageWorld,
    url: (world) => conversationUrlOf(world),
  }),
}

/** A long conversation of four exchanges, with replies built of headings, tables and code. */
export const LongConversation: Story = {
  parameters: desk({
    world: buildLongConversationWorld,
    url: (world) => conversationUrlOf(world),
  }),
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
  // It pastes it, which the editor of the box reads whole in the tests' DOM too.
  play: async ({ canvasElement }) => {
    const composer = await within(canvasElement).findByRole(
      "textbox",
      { name: /Helpful Assistant/ },
      { timeout: 5000 },
    )
    await userEvent.click(composer)
    await userEvent.paste("Hello")
    await userEvent.keyboard("{Enter}")
  },
}
