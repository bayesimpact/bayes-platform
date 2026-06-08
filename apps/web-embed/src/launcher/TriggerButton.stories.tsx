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
  displayMode = "modal" as const,
}: {
  primaryColor?: string
  position?: "bottom-right" | "bottom-left"
  displayMode?: "modal" | "drawer"
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

  const isDrawer = displayMode === "drawer"
  const isRight = position !== "bottom-left"

  return (
    <>
      {isDrawer ? (
        <div
          className="fixed top-0 h-full w-[400px] shadow-2xl transition-transform duration-300"
          style={{
            [isRight ? "right" : "left"]: 0,
            transform: isOpen
              ? "translateX(0)"
              : isRight
                ? "translateX(100%)"
                : "translateX(-100%)",
          }}
        >
          <EmbedChat
            agentName="Support Assistant"
            theme={{ primaryColor }}
            displayMode="drawer"
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={handleSend}
            onClose={() => setIsOpen(false)}
          />
        </div>
      ) : (
        isOpen && (
          <div
            className="fixed flex flex-col gap-3"
            style={{
              bottom: 88,
              ...(isRight ? { right: 24 } : { left: 24 }),
            }}
          >
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
          </div>
        )
      )}
      <div className="fixed bottom-6" style={isRight ? { right: 24 } : { left: 24 }}>
        <TriggerButton
          isOpen={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          primaryColor={primaryColor}
          position={position}
        />
      </div>
    </>
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

// ---------------------------------------------------------------------------
// Drawer mode — self-contained interactive demos (start open to show the panel)
// ---------------------------------------------------------------------------

function DrawerDemo({
  primaryColor = "#2563eb",
  position = "bottom-right" as const,
}: {
  primaryColor?: string
  position?: "bottom-right" | "bottom-left"
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [messages, setMessages] = useState(shortConversation)
  const [isStreaming, setIsStreaming] = useState(false)
  const isRight = position !== "bottom-left"

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
    <div className="relative h-screen w-full overflow-hidden bg-gray-100">
      {/* Host page placeholder */}
      <div className="p-10">
        <p className="mb-2 text-base font-semibold text-gray-700">Host page content</p>
        <p className="text-sm text-gray-400">
          Click the FAB button to toggle the drawer open / closed.
        </p>
      </div>

      {/* Drawer panel — slides in from the edge */}
      <div
        className="absolute top-0 h-full w-[400px] shadow-2xl"
        style={{
          [isRight ? "right" : "left"]: 0,
          transform: isOpen ? "translateX(0)" : isRight ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 0.3s ease",
        }}
      >
        <EmbedChat
          agentName="Support Assistant"
          theme={{ primaryColor }}
          displayMode="drawer"
          messages={messages}
          isStreaming={isStreaming}
          onSendMessage={handleSend}
          onClose={() => setIsOpen(false)}
        />
      </div>

      {/* FAB button */}
      <div className="absolute bottom-6" style={isRight ? { right: 24 } : { left: 24 }}>
        <TriggerButton
          isOpen={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          primaryColor={primaryColor}
          position={position}
        />
      </div>
    </div>
  )
}

export const DrawerRight: Story = {
  name: "Drawer — Right (starts open)",
  parameters: { layout: "fullscreen" },
  render: () => <DrawerDemo primaryColor="#2563eb" position="bottom-right" />,
}

export const DrawerLeft: Story = {
  name: "Drawer — Left (starts open)",
  parameters: { layout: "fullscreen" },
  render: () => <DrawerDemo primaryColor="#7c3aed" position="bottom-left" />,
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
