import type { Meta, StoryObj } from "@storybook/react-vite"
import { noEvaluationAccessHandlers } from "@/test/msw/handlers"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

/** The app around its pages: the home, a person without access, and a page that does not exist. */
const meta = {
  title: "Evaluation/General",
  ...evalMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Home: Story = {}

/** A person who is the evaluator of no project. */
export const NoEvaluationAccess: Story = {
  parameters: evaluation({ handlers: noEvaluationAccessHandlers }),
}

export const PageNotFound: Story = {
  parameters: evaluation({ url: "/eval/unknown-page" }),
}
