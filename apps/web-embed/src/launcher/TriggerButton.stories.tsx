import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { longConversation, shortConversation } from "../chat/chat.factory"
import { EmbedChat } from "../chat/EmbedChat"
import { TriggerButton } from "./TriggerButton"

const meta = {
  title: "Launcher/TriggerButton",
  component: TriggerButton,
  parameters: { layout: "centered" },
  args: {
    isOpen: false,
    onClick: () => {},
  },
} satisfies Meta<typeof TriggerButton>

export default meta
type Story = StoryObj<typeof meta>

// ---------------------------------------------------------------------------
// Isolated button states
// ---------------------------------------------------------------------------

export const Closed: Story = {
  args: { isOpen: false },
}

export const Open: Story = {
  args: { isOpen: true },
}

export const PositionLeft: Story = {
  name: "Position — Bottom Left",
  args: { isOpen: false, position: "bottom-left" },
}

export const ThemeGreen: Story = {
  name: "Theme — Green",
  args: { isOpen: false, primaryColor: "#16a34a" },
}

export const ThemePurple: Story = {
  name: "Theme — Purple",
  args: { isOpen: false, primaryColor: "#7c3aed" },
}

export const ThemeDark: Story = {
  name: "Theme — Dark",
  args: { isOpen: false, primaryColor: "#111827" },
}

// ---------------------------------------------------------------------------
// Interactive — toggle open / close
// ---------------------------------------------------------------------------

export const Interactive: Story = {
  name: "Interactive toggle",
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false)
    return <TriggerButton {...args} isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
  },
}

// ---------------------------------------------------------------------------
// Full widget — button + chat panel composed
// Mirrors what the launcher script produces on a real page.
// ---------------------------------------------------------------------------

function FullWidget({
  primaryColor = "#2563eb",
  position = "bottom-right" as const,
}: {
  primaryColor?: string
  position?: "bottom-right" | "bottom-left"
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(shortConversation)
  const [isStreaming, setIsStreaming] = useState(false)

  const handleSend = (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user" as const, content, status: "completed" as const },
    ])
    setIsStreaming(true)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant" as const,
          content: "Thanks for your message! This is a Storybook demo response.",
          status: "completed" as const,
        },
      ])
      setIsStreaming(false)
    }, 1200)
  }

  return (
    <div
      className="fixed bottom-6 flex flex-col gap-3"
      style={position === "bottom-right" ? { right: 24 } : { left: 24 }}
    >
      {isOpen && (
        <div className="h-[560px] w-[380px] overflow-hidden rounded-2xl shadow-2xl">
          <EmbedChat
            agentName="Support Assistant"
            theme={{ primaryColor }}
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={handleSend}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
      <TriggerButton
        isOpen={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        primaryColor={primaryColor}
        position={position}
      />
    </div>
  )
}

export const FullWidgetBottomRight: Story = {
  name: "Full widget — Bottom Right",
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="h-screen w-full bg-gray-100 p-8">
      <p className="text-gray-500 text-sm">← Simulated host page content</p>
      <FullWidget primaryColor="#2563eb" position="bottom-right" />
    </div>
  ),
}

export const FullWidgetBottomLeft: Story = {
  name: "Full widget — Bottom Left",
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="h-screen w-full bg-gray-100 p-8">
      <p className="text-gray-500 text-sm">← Simulated host page content</p>
      <FullWidget primaryColor="#2563eb" position="bottom-left" />
    </div>
  ),
}

export const FullWidgetGreen: Story = {
  name: "Full widget — Green theme",
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="h-screen w-full bg-gray-100 p-8">
      <FullWidget primaryColor="#16a34a" />
    </div>
  ),
}

export const FullWidgetLongConversation: Story = {
  name: "Full widget — Long conversation",
  parameters: { layout: "fullscreen" },
  render: () => {
    const [isOpen, setIsOpen] = useState(true)
    return (
      <div className="h-screen w-full bg-gray-100 p-8">
        <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3">
          {isOpen && (
            <div className="h-[560px] w-[380px] overflow-hidden rounded-2xl shadow-2xl">
              <EmbedChat
                agentName="Support Assistant"
                messages={longConversation}
                isStreaming={false}
                onSendMessage={() => {}}
                onClose={() => setIsOpen(false)}
              />
            </div>
          )}
          <TriggerButton isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
        </div>
      </div>
    )
  },
}
