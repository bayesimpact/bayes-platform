import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  buildErrorMessage,
  buildStreamingMessage,
  emptyConversation,
  longConversation,
  markdownConversation,
  shortConversation,
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
  },
} satisfies Meta<typeof EmbedChat>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    messages: emptyConversation,
  },
}

export const ShortConversation: Story = {
  args: {
    messages: shortConversation,
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

export const NoCloseButton: Story = {
  args: {
    messages: shortConversation,
    onClose: undefined,
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
