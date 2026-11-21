import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  buildErrorMessage,
  buildStreamingMessage,
  emptyConversation,
  failedMcpAppCardConversation,
  followUpQuestionsAfterNewMessageConversation,
  loadingMcpAppCardConversation,
  longConversation,
  markdownConversation,
  maxFollowUpQuestionsConversation,
  oneFollowUpQuestionConversation,
  resourceCardsConversation,
  resourceCardsOnlyConversation,
  shortConversation,
  sourcesConversation,
  textWithMcpAppCardConversation,
} from "./chat.factory"
import { EmbedChat } from "./EmbedChat"

const meta = {
  title: "Embed/EmbedChat",
  component: EmbedChat,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="h-[600px] w-[400px] overflow-hidden rounded-2xl shadow-xl">
        <Story />
      </div>
    ),
  ],
  args: {
    agentName: "Support Assistant",
    isStreaming: false,
    onSendMessage: (content) => console.log("send:", content),
    onClose: () => console.log("close"),
    onNewConversation: () => console.log("new conversation"),
  },
} satisfies Meta<typeof EmbedChat>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    messages: emptyConversation,
  },
}

export const PreviousSessionExpired: Story = {
  args: {
    messages: emptyConversation,
    isPreviousSessionExpired: true,
  },
}

export const ShortConversation: Story = {
  args: {
    messages: shortConversation,
  },
}

export const WithBanner: Story = {
  args: {
    messages: shortConversation,
    bannerText: "Test version, for the pilot team only. Answers may be incomplete.",
  },
}

export const WithBannerNoHeader: Story = {
  name: "With banner — header hidden",
  args: {
    messages: shortConversation,
    hideHeader: true,
    bannerText: "Test version, for the pilot team only.",
  },
}

export const LongConversation: Story = {
  args: {
    messages: longConversation,
  },
}

export const MarkdownFormatting: Story = {
  args: {
    messages: markdownConversation,
  },
}

export const Streaming: Story = {
  args: {
    messages: [
      ...shortConversation,
      { id: "user-follow-up", role: "user", content: "Can you elaborate?", status: "completed" },
      buildStreamingMessage("Let me think about that"),
    ],
    isStreaming: true,
  },
}

export const StreamingEmpty: Story = {
  name: "Streaming — thinking (empty content)",
  args: {
    messages: [
      ...shortConversation,
      { id: "user-q", role: "user", content: "What's the return policy?", status: "completed" },
      buildStreamingMessage(""),
    ],
    isStreaming: true,
  },
}

export const ErrorState: Story = {
  args: {
    messages: [
      ...shortConversation,
      { id: "user-err", role: "user", content: "This will fail.", status: "completed" },
      buildErrorMessage(),
    ],
  },
}

export const FollowUpQuestionsNone: Story = {
  name: "Follow-up questions — none",
  args: {
    messages: shortConversation,
  },
}

export const FollowUpQuestionsOne: Story = {
  name: "Follow-up questions — one",
  args: {
    messages: oneFollowUpQuestionConversation,
  },
}

export const FollowUpQuestionsMax: Story = {
  name: "Follow-up questions — maximum",
  args: {
    messages: maxFollowUpQuestionsConversation,
  },
}

export const FollowUpQuestionsHiddenAfterNewMessage: Story = {
  name: "Follow-up questions — hidden after a new message",
  args: {
    messages: followUpQuestionsAfterNewMessageConversation,
  },
}

export const LoadingMcpAppCard: Story = {
  name: "MCP App card loading",
  args: {
    messages: loadingMcpAppCardConversation,
    isMcpAppHtmlLoading: true,
  },
}

export const TextWithMcpAppCard: Story = {
  name: "MCP App card with reply text",
  args: {
    messages: textWithMcpAppCardConversation,
  },
}

export const FailedMcpAppCard: Story = {
  name: "MCP App card failed to load",
  args: {
    messages: failedMcpAppCardConversation,
  },
}

export const NewConversationConfirm: Story = {
  name: "New conversation — confirm after the visitor wrote",
  args: {
    messages: shortConversation,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "New conversation" }))
    await expect(canvas.getByRole("alertdialog")).toBeInTheDocument()
  },
}

export const NewConversationConfirmFrench: Story = {
  name: "New conversation — confirm, French",
  args: {
    locale: "fr",
    messages: shortConversation,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Nouvelle conversation" }))
    await expect(canvas.getByRole("alertdialog")).toBeInTheDocument()
  },
}

export const NewConversationNoConfirm: Story = {
  name: "New conversation — no confirm before the visitor wrote",
  args: {
    messages: emptyConversation,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "New conversation" }))
    await expect(canvas.queryByRole("alertdialog")).not.toBeInTheDocument()
  },
}

export const QueuedMessage: Story = {
  name: "Streaming — message written during the reply waits",
  args: {
    locale: "fr",
    messages: [
      ...shortConversation,
      { id: "user-q", role: "user", content: "What's the return policy?", status: "completed" },
      buildStreamingMessage("Returns are free within 30 days"),
    ],
    isStreaming: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("textbox"), "And for sale items?{Enter}")
    await expect(canvas.getByText("Envoyé à la fin de la réponse")).toBeInTheDocument()
  },
}

export const NoCloseButton: Story = {
  args: {
    messages: shortConversation,
    onClose: undefined,
  },
}

export const HiddenHeader: Story = {
  args: {
    messages: shortConversation,
    hideHeader: true,
  },
}

export const CustomPlaceholder: Story = {
  args: {
    messages: emptyConversation,
    placeholder: "Ask a question…",
    agentName: "Helpful Assistant",
  },
}

export const ThemeGreen: Story = {
  name: "Theme — Green",
  args: {
    agentName: "Support Chat",
    messages: shortConversation,
    theme: { primaryColor: "#16a34a" },
  },
}

export const ThemePurple: Story = {
  name: "Theme — Purple",
  args: {
    agentName: "AI Advisor",
    messages: shortConversation,
    theme: { primaryColor: "#7c3aed" },
  },
}

export const ThemeOrange: Story = {
  name: "Theme — Orange",
  args: {
    agentName: "Help Desk",
    messages: shortConversation,
    theme: { primaryColor: "#ea580c" },
  },
}

export const ThemeDark: Story = {
  name: "Theme — Dark",
  args: {
    agentName: "Assistant",
    messages: longConversation,
    theme: { primaryColor: "#111827" },
  },
}

export const French: Story = {
  name: "Locale — French",
  args: {
    locale: "fr",
    messages: shortConversation,
  },
}

export const FrenchStreaming: Story = {
  name: "Locale — French streaming",
  args: {
    locale: "fr",
    messages: [
      ...shortConversation,
      { id: "u", role: "user", content: "Et autre chose ?", status: "completed" },
      buildStreamingMessage(""),
    ],
    isStreaming: true,
  },
}

export const CustomLogo: Story = {
  name: "Theme — Custom logo",
  args: {
    agentName: "Acme Support",
    messages: shortConversation,
    theme: {
      primaryColor: "#0f766e",
      logoUrl: "https://placehold.co/36x36/0f766e/ffffff?text=A",
    },
  },
}

export const Sources: Story = {
  name: "Sources",
  args: {
    messages: sourcesConversation,
  },
}

export const SourcesFrench: Story = {
  name: "Sources — French",
  args: {
    locale: "fr",
    messages: sourcesConversation,
  },
}

export const ResourceCards: Story = {
  name: "Resource cards",
  args: {
    messages: resourceCardsConversation,
  },
}

export const ResourceCardsOnly: Story = {
  name: "Resource cards — no assistant text",
  args: {
    messages: resourceCardsOnlyConversation,
  },
}

export const DisplayModeDrawer: Story = {
  name: "Display mode — Drawer",
  decorators: [
    (Story) => (
      <div className="h-screen w-[400px] overflow-hidden shadow-xl">
        <Story />
      </div>
    ),
  ],
  args: {
    messages: shortConversation,
    displayMode: "drawer",
  },
}
