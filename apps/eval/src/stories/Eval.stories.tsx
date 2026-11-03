import type { Meta, StoryObj } from "@storybook/react-vite"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

/** The app around its pages: the home, and a page that does not exist. */
const meta = {
  title: "Evaluation/General",
  ...evalMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Home: Story = {}

export const PageNotFound: Story = {
  parameters: evaluation({ url: "/eval/unknown-page" }),
}
