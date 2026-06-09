import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useState } from "react"
import { longConversation, shortConversation } from "../chat/chat.factory"
import { EmbedChat } from "../chat/EmbedChat"
import { TriggerButton } from "./TriggerButton"

// ─── Hint bubble ────────────────────────────────────────────────────────────
// Mirrors the vanilla-JS bubble created by makeFabRow in launcher/index.ts.

function HintBubble({
  text,
  isRight,
  hovered,
}: {
  text: string
  isRight: boolean
  hovered: boolean
}) {
  const [autoVisible, setAutoVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setAutoVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  const visible = autoVisible || hovered

  return (
    <div
      className="pointer-events-none select-none whitespace-nowrap rounded-[10px] bg-white px-[14px] py-2 text-[13px] leading-snug text-gray-700 shadow-[0_2px_16px_rgba(0,0,0,0.14)] transition-opacity duration-[250ms]"
      style={{ opacity: visible ? 1 : 0, order: isRight ? -1 : 1 }}
    >
      {text}
    </div>
  )
}

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
  hint,
}: {
  primaryColor?: string
  position?: "bottom-right" | "bottom-left"
  displayMode?: "modal" | "drawer"
  hint?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(shortConversation)
  const [isStreaming, setIsStreaming] = useState(false)
  const [buttonHovered, setButtonHovered] = useState(false)

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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only listeners for hint bubble visibility */}
      <div
        className="fixed bottom-6 flex items-center gap-[10px]"
        style={isRight ? { right: 24 } : { left: 24 }}
        onMouseEnter={() => setButtonHovered(true)}
        onMouseLeave={() => setButtonHovered(false)}
      >
        {hint && <HintBubble text={hint} isRight={isRight} hovered={buttonHovered} />}
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
  hint,
}: {
  primaryColor?: string
  position?: "bottom-right" | "bottom-left"
  hint?: string
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [messages, setMessages] = useState(shortConversation)
  const [isStreaming, setIsStreaming] = useState(false)
  const [buttonHovered, setButtonHovered] = useState(false)
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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only listeners for hint bubble visibility */}
      <div
        className="absolute bottom-6 flex items-center gap-[10px]"
        style={isRight ? { right: 24 } : { left: 24 }}
        onMouseEnter={() => setButtonHovered(true)}
        onMouseLeave={() => setButtonHovered(false)}
      >
        {hint && !isOpen && <HintBubble text={hint} isRight={isRight} hovered={buttonHovered} />}
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

// ---------------------------------------------------------------------------
// Hint — auto-shows for 5 s then reappears on hover
// ---------------------------------------------------------------------------

export const HintModal: Story = {
  name: "Hint — Modal (auto-show + hover)",
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="h-screen w-full bg-gray-100 p-8">
      <p className="text-sm text-gray-500">Hint appears for 5 s then on hover.</p>
      <FullWidget primaryColor="#2563eb" position="bottom-right" hint="Need help? Ask us!" />
    </div>
  ),
}

export const HintModalLeft: Story = {
  name: "Hint — Modal (bottom-left)",
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="h-screen w-full bg-gray-100 p-8">
      <FullWidget primaryColor="#7c3aed" position="bottom-left" hint="Need help? Ask us!" />
    </div>
  ),
}

export const HintDrawer: Story = {
  name: "Hint — Drawer (auto-show + hover)",
  parameters: { layout: "fullscreen" },
  render: () => (
    <DrawerDemo primaryColor="#2563eb" position="bottom-right" hint="Need help? Ask us!" />
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
