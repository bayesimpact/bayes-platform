import type { Meta, StoryObj } from "@storybook/react-vite"

/**
 * These stories render the chat inside a real <iframe> that loads the Vite
 * dev server at http://localhost:5175.
 *
 * ⚠️  The Vite dev server must be running:
 *       npm run dev   (from apps/web-embed)
 *     or from the repo root:
 *       npx turbo dev --filter=web-embed
 *
 * URL params supported by the preview page:
 *   primaryColor  — any CSS colour value (URI-encoded)
 *   locale        — "en" | "fr"
 *   agentName     — display name in the header
 *   logoUrl       — URL of a logo image
 */

const DEV_SERVER = "http://localhost:5175"

function buildSrc(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
  ).toString()
  return qs ? `${DEV_SERVER}?${qs}` : DEV_SERVER
}

interface IframeStoryProps {
  primaryColor?: string
  locale?: "en" | "fr"
  agentName?: string
  logoUrl?: string
}

function ChatIframe({ primaryColor, locale, agentName, logoUrl }: IframeStoryProps) {
  return (
    <iframe
      src={buildSrc({ primaryColor, locale, agentName, logoUrl })}
      title="AgentStudio chat preview"
      style={{ border: "none", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
      className="h-[600px] w-[380px]"
    />
  )
}

const meta = {
  title: "Launcher/IframePreview",
  component: ChatIframe,
  parameters: { layout: "centered" },
  args: { locale: "en" },
} satisfies Meta<typeof ChatIframe>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: "Default (blue)",
  args: { agentName: "Support Assistant" },
}

export const French: Story = {
  name: "Locale — French",
  args: { agentName: "Assistant Support", locale: "fr" },
}

export const ThemeGreen: Story = {
  name: "Theme — Green",
  args: { primaryColor: "#16a34a", agentName: "Support Chat" },
}

export const ThemePurple: Story = {
  name: "Theme — Purple",
  args: { primaryColor: "#7c3aed", agentName: "AI Advisor" },
}

export const ThemeDark: Story = {
  name: "Theme — Dark",
  args: { primaryColor: "#111827", agentName: "Assistant" },
}

export const CustomLogo: Story = {
  name: "Custom logo",
  args: {
    primaryColor: "#0f766e",
    agentName: "Acme Support",
    logoUrl: "https://placehold.co/36x36/0f766e/ffffff?text=A",
  },
}

// ---------------------------------------------------------------------------
// Side-by-side — two iframes to compare locale or theme at a glance
// ---------------------------------------------------------------------------

export const SideBySideLocales: Story = {
  name: "Side by side — EN vs FR",
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="flex h-screen items-center justify-center gap-8 bg-gray-100 p-8">
      <div className="flex flex-col items-center gap-2">
        <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">English</span>
        <ChatIframe agentName="Support Assistant" locale="en" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Français</span>
        <ChatIframe agentName="Assistant Support" locale="fr" />
      </div>
    </div>
  ),
}

export const SideBySideThemes: Story = {
  name: "Side by side — Themes",
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="flex h-screen items-center justify-center gap-8 bg-gray-100 p-8">
      {[
        { color: "#2563eb", label: "Blue" },
        { color: "#16a34a", label: "Green" },
        { color: "#7c3aed", label: "Purple" },
      ].map(({ color, label }) => (
        <div key={color} className="flex flex-col items-center gap-2">
          <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">{label}</span>
          <ChatIframe primaryColor={color} agentName="Assistant" />
        </div>
      ))}
    </div>
  ),
}
