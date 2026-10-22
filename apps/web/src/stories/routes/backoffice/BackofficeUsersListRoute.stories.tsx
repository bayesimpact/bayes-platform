import type { Meta, StoryObj } from "@storybook/react-vite"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { BackofficeUserRoutes } from "@/backoffice/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  type BackofficeStoryArgs,
  backofficeStoryArgs,
  backofficeStoryArgTypes,
  buildBackofficeData,
  buildMockBackofficeService,
} from "@/stories/routes/backoffice/helpers"

type StoryArgs = BackofficeStoryArgs

// The panel lists users again on mount: the mock service returns the seeded page.
const decorator = buildDecorator<StoryArgs>((args) => {
  const { baseSeeds, users } = buildBackofficeData(args)
  return {
    state: baseSeeds,
    services: { backoffice: buildMockBackofficeService({ users }) },
  }
})

const meta = {
  title: "routes/backoffice/users/list",
  parameters: { layout: "fullscreen" },
  argTypes: backofficeStoryArgTypes,
  args: backofficeStoryArgs,
  decorators: [decorator],
  render: render({
    path: BackofficeUserRoutes.users.path,
    routes: backofficeRoutes,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const Empty: Story = {
  args: { ...backofficeStoryArgs, withUsers: false },
}
