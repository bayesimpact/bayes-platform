import type { Meta, StoryObj } from "@storybook/react-vite"
import { embedDevServer } from "./devServer"

/**
 * The real launcher (src/launcher/index.ts), as a client site shows it: the button, the toast (the
 * agent's greeting, or the hint when the agent has no greeting) and the chat window. Each story
 * loads launcher-demo.html from the embed dev server in an iframe; that page mounts the launcher on
 * the simulated chat of the embed app.
 *
 * Outside a worktree environment, start the embed dev server first (`npm run dev` in
 * apps/web-embed). The toast shows once per browser tab: open the story in a new tab to see it again.
 */

interface LauncherStoryProps {
  color?: string
  locale?: "en" | "fr"
  displayMode?: "modal" | "drawer"
  position?: "bottom-right" | "bottom-left"
  hint?: string
  greeting?: boolean
}

function LauncherDemo({ greeting = true, ...props }: LauncherStoryProps) {
  const params = new URLSearchParams(
    Object.entries({ ...props, greeting: greeting ? undefined : "false" }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
  return (
    <iframe
      key={params.toString()}
      src={`${embedDevServer()}/launcher-demo.html?${params}`}
      title="Launcher on a host page"
      style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
    />
  )
}

const meta = {
  title: "Launcher/Launcher",
  component: LauncherDemo,
  parameters: { layout: "fullscreen" },
  argTypes: {
    color: { control: "color" },
    locale: { control: "inline-radio", options: ["en", "fr"] },
    displayMode: { control: "inline-radio", options: ["modal", "drawer"] },
    position: { control: "inline-radio", options: ["bottom-right", "bottom-left"] },
    hint: { control: "text" },
    greeting: { control: "boolean" },
  },
} satisfies Meta<typeof LauncherDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const French: Story = { args: { locale: "fr" } }

export const CustomColor: Story = { args: { color: "#e5826a" } }

export const WithHint: Story = { args: { hint: "Need help?", greeting: false } }

export const NoGreetingPreview: Story = { args: { greeting: false } }

export const Drawer: Story = { args: { displayMode: "drawer" } }

export const BottomLeft: Story = { args: { position: "bottom-left" } }
