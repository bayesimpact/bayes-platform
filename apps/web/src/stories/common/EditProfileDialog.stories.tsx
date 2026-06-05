import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { EditProfileDialog } from "@/common/components/sidebar/nav/EditProfileDialog"
import { userFactory } from "@/common/features/me/me.factory"
import type { IMeSpi } from "@/common/features/me/me.spi"
import { buildDecorator } from "@/stories/decorators"
import { seed } from "@/stories/seed"

function buildMockMeService(overrides: Partial<IMeSpi> = {}): IMeSpi {
  return {
    getMe: fn(),
    acceptTerms: fn(),
    updateMe: fn(),
    ...overrides,
  }
}

const user = userFactory.build({ name: "Didier Lafforgue", email: "didier@example.com" })

const meta = {
  title: "common/EditProfileDialog",
  component: EditProfileDialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    onClose: fn(),
  },
  decorators: [
    buildDecorator(() => ({
      state: seed.me(user),
      services: {
        me: buildMockMeService({
          updateMe: async () => {},
        }),
      },
    })),
  ],
} satisfies Meta<typeof EditProfileDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongName: Story = {
  decorators: [
    buildDecorator(() => {
      const longNameUser = userFactory.build({
        name: "Marie-Hélène Fontaine-Dupont",
        email: "marie@example.com",
      })
      return {
        state: seed.me(longNameUser),
        services: {
          me: buildMockMeService({
            updateMe: async () => {},
          }),
        },
      }
    }),
  ],
}
