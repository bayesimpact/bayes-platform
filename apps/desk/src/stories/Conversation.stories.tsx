import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fireEvent, userEvent, within } from "storybook/test"
import { conversationUrlOf } from "@/test/desk-urls"
import {
  buildEmptyHistoryWorld,
  buildFollowUpQuestionsWorld,
  buildGreetingWorld,
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

/** The person selected a passage of a reply: a box offers to copy or annotate it. */
export const PassageSelected: Story = {
  parameters: desk({ url: (world) => conversationUrlOf(world) }),
  // It selects "Pro plan" in the reply, as the mouse does, and lets the mouse button come up.
  play: async ({ canvasElement }) => {
    const passage = await within(canvasElement).findByText(
      /The Pro plan also adds/,
      {},
      { timeout: 5000 },
    )
    const text = passage.firstChild
    if (!text) throw new Error("The reply has no text")
    const range = document.createRange()
    range.setStart(text, 4)
    range.setEnd(text, 12)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    fireEvent.mouseUp(passage)
  },
}

/**
 * A long conversation of five exchanges, with replies built of headings, tables and code, and
 * messages that annotate passages of the reply before.
 */
export const LongConversation: Story = {
  parameters: desk({
    world: buildLongConversationWorld,
    url: (world) => conversationUrlOf(world),
  }),
}

const followUpQuestions = [
  "What does renew mean?",
  "How do I cancel my plan?",
  "Can I change my plan later?",
  "Do I get a refund if I cancel in the middle of the month, and how long does it take to reach my account?",
]

/** The last reply suggests one question the person can send with a click. */
export const OneFollowUpQuestion: Story = {
  parameters: desk({
    world: () => buildFollowUpQuestionsWorld({ questions: followUpQuestions.slice(0, 1) }),
    url: (world) => conversationUrlOf(world),
  }),
}

/** The last reply suggests the most questions an agent allows, four. */
export const MostFollowUpQuestions: Story = {
  parameters: desk({
    world: () => buildFollowUpQuestionsWorld({ questions: followUpQuestions }),
    url: (world) => conversationUrlOf(world),
  }),
}

/** The person sent a suggested question: the questions of the earlier reply are gone. */
export const FollowUpQuestionAnswered: Story = {
  parameters: desk({
    world: () => buildFollowUpQuestionsWorld({ questions: followUpQuestions, answered: true }),
    url: (world) => conversationUrlOf(world),
  }),
}

export const FirstConversation: Story = {
  parameters: desk({ world: buildEmptyHistoryWorld }),
}

/** A new conversation with an agent that has a greeting: it shows the greeting, not a question. */
export const NewConversationWithGreeting: Story = {
  parameters: desk({ world: buildGreetingWorld }),
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
