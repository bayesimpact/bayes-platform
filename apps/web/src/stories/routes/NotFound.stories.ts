import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import { NotFoundRoute as Comp } from "@/common/routes/NotFoundRoute"
import { withRedux } from "../decorators/with-redux"

const meta = {
  title: "routes/NotFound",
  component: Comp,
  decorators: [withRouter, withRedux()],
  parameters: {
    layout: "fullscreen",
    // reactRouter: reactRouterParameters({
    //   location: {
    //     pathParams: { userId: '42' },
    //   },
    //   routing: { path: '/users/:userId' },
    // }),
  },
} satisfies Meta<typeof Comp>

export default meta
type Story = StoryObj<typeof meta>

export const NotFound: Story = {}
