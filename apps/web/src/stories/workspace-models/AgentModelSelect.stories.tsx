import { AgentModel } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, userEvent, within } from "storybook/test"
import {
  type AgentModelOption,
  AgentModelSelect,
} from "@/studio/features/agents/agent-settings/components/tabs/AgentModelSelect"

const codeModels: AgentModelOption[] = [
  {
    value: AgentModel.Gemini35Flash,
    name: "Gemini 3.5 Flash",
    modelId: AgentModel.Gemini35Flash,
    group: "Google",
    tags: ["recommended", "reasoning"],
  },
  {
    value: AgentModel.Gemini35FlashLite,
    name: "Gemini 3.5 Flash Lite",
    modelId: AgentModel.Gemini35FlashLite,
    group: "Google",
    tags: ["reasoning"],
  },
  {
    value: AgentModel.Gemini4Carbon,
    name: "Gemini 4 Carbon",
    modelId: AgentModel.Gemini4Carbon,
    group: "Google",
    tags: ["outsideEu", "reasoning"],
  },
  {
    value: AgentModel.Gemini25Flash,
    name: "Gemini 2.5 Flash",
    modelId: AgentModel.Gemini25Flash,
    group: "Google",
    tags: [],
    retirement: { date: "Sep 30", replacement: "Gemini 3.5 Flash", past: false },
  },
  {
    value: AgentModel.Gemma4_26B,
    name: "Gemma 4 26B",
    modelId: AgentModel.Gemma4_26B,
    group: "Google",
    tags: ["selfHosted"],
  },
  {
    value: AgentModel.ClaudeSonnet55,
    name: "Claude Sonnet 5.5",
    modelId: AgentModel.ClaudeSonnet55,
    group: "Anthropic",
    tags: ["reasoning"],
  },
  {
    value: AgentModel.Gpt54,
    name: "GPT-5.4",
    modelId: AgentModel.Gpt54,
    group: "OpenAI",
    tags: ["outsideEu", "reasoning"],
  },
  {
    value: AgentModel.Qwen38_27B,
    name: "Qwen 3.8 27B",
    modelId: AgentModel.Qwen38_27B,
    group: "Qwen",
    tags: ["selfHosted"],
  },
]

const addedModels: AgentModelOption[] = [
  {
    value: "custom:gemma-new-server",
    name: "Gemma 4 on the new server",
    modelId: AgentModel.Gemma4_26B,
    group: "Models of this workspace",
    tags: ["selfHosted"],
  },
  {
    value: "custom:qwen-test",
    name: "Qwen test",
    modelId: AgentModel.Qwen38_27B,
    group: "Models of this workspace",
    tags: ["selfHosted"],
  },
]

const meta = {
  title: "workspace-models/AgentModelSelect",
  component: AgentModelSelect,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto flex max-w-lg flex-col gap-2 pb-[32rem]">
        <span className="text-sm font-medium">Model</span>
        <Story />
      </div>
    ),
  ],
  args: {
    value: AgentModel.Gemini35Flash,
    onChange: fn(),
    options: codeModels,
    labels: {
      placeholder: "Pick a model",
      searchPlaceholder: "Search a model",
      noResults: "No model found",
      tags: {
        recommended: "Recommended",
        outsideEu: "Outside the EU",
        // The operator's name comes from the API (`SELF_HOSTED_MODELS_OPERATOR`).
        selfHosted: "Self-hosted by Bayes",
        priority: "Priority",
        reasoning: "Adjustable reasoning",
      },
      retires: (date, past) => `${past ? "Retired" : "Retires"} on ${date}`,
    },
    defaultOpen: true,
  },
} satisfies Meta<typeof AgentModelSelect>

export default meta
type Story = StoryObj<typeof meta>

/** A workspace without added models: grouped by vendor, with what matters to pick one. */
export const CodeModelsOnly: Story = {}

/** The models the workspace added come last. Their server is never shown outside the backoffice. */
export const WithAddedModels: Story = {
  args: { options: [...codeModels, ...addedModels] },
}

/** A search keeps the models whose name, technical id or vendor matches every word. */
export const Searching: Story = {
  args: { options: [...codeModels, ...addedModels], defaultOpen: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("combobox"))
    // The list opens in a portal, outside the story's canvas.
    const page = within(document.body)
    await userEvent.type(await page.findByPlaceholderText("Search a model"), "qwen")
  },
}

/** The agent calls its model with the priority tier: the badge shows on that model only. */
export const PriorityCallsOn: Story = {
  args: {
    options: codeModels.map((option) =>
      option.value === AgentModel.Gemini35Flash
        ? { ...option, tags: [...option.tags, "priority"] }
        : option,
    ),
    defaultOpen: false,
  },
}

/** Closed, on an added model: the trigger shows its name and the model it runs. */
export const AddedModelPicked: Story = {
  args: {
    options: [...codeModels, ...addedModels],
    value: "custom:gemma-new-server",
    defaultOpen: false,
  },
}
