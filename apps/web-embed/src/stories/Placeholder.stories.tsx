import type { Meta, StoryObj } from "@storybook/react-vite"

function Placeholder() {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
      <p className="text-gray-400 text-sm">Chat components will live here</p>
    </div>
  )
}

const meta = {
  title: "Embed/Placeholder",
  component: Placeholder,
} satisfies Meta<typeof Placeholder>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
