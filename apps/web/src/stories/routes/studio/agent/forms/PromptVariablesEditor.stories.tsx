import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import {
  type PromptVariableField,
  PromptVariablesEditor,
} from "@/studio/features/agents/prompt-variables/PromptVariablesEditor"

type StoryArgs = {
  fields: PromptVariableField[]
  requireValues: boolean
}

function StatefulStory({ fields: initialFields, requireValues }: StoryArgs) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialFields.map((field) => [field.name, field.value])),
  )

  const fields: PromptVariableField[] = initialFields.map((field) => ({
    ...field,
    value: values[field.name] ?? "",
  }))

  return (
    <div className="mx-auto max-w-2xl rounded-lg border p-6">
      <PromptVariablesEditor
        title="Prompt variables"
        description="Values for the variables the agent declares in its instructions. Each one is substituted into the prompt before a model call."
        fields={fields}
        requireValues={requireValues}
        onChange={setValues}
      />
    </div>
  )
}

const meta = {
  title: "routes/studio/project/agent/PromptVariablesEditor",
  component: StatefulStory,
  parameters: { layout: "padded" },
  argTypes: {
    requireValues: { control: "boolean" },
  },
} satisfies Meta<typeof StatefulStory>

export default meta
type Story = StoryObj<typeof meta>

/** Playground channel: the caller must supply a value for every declared variable. */
export const Playground: Story = {
  args: {
    requireValues: true,
    fields: [
      { name: "topic", value: "" },
      { name: "audience", value: "" },
      { name: "tone", value: "" },
    ],
  },
}

/** Same channel, mid-fill: some supplied, one still missing. */
export const WithValues: Story = {
  args: {
    requireValues: true,
    fields: [
      { name: "topic", value: "The new pricing page" },
      { name: "audience", value: "" },
      { name: "tone", value: "Friendly" },
    ],
  },
}

/** Embed channel: the operator sets defaults; a blank value is allowed (the caller may supply one). */
export const EmbedDefaults: Story = {
  args: {
    requireValues: false,
    fields: [
      { name: "topic", value: "The new pricing page" },
      { name: "audience", value: "", defaultValue: "existing customers" },
      { name: "tone", value: "", defaultValue: "neutral" },
    ],
  },
}
