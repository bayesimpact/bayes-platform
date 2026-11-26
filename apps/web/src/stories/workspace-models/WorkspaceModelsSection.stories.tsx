import { AgentModel } from "@bayes-platform/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import {
  buildCustomModelTypes,
  customModelFactory,
  projectModelFactory,
} from "@/backoffice/features/backoffice/backoffice.factory"
import { WorkspaceModelsSection } from "@/backoffice/features/backoffice/components/custom-models/WorkspaceModelsSection"

const codeModels = [
  projectModelFactory.build({
    model: AgentModel.Gemini25Flash,
    retirement: { date: "2026-09-30", replacement: "Gemini 3.5 Flash Lite" },
  }),
  projectModelFactory.build({ model: AgentModel.Gemini35Flash }),
  projectModelFactory.build({ model: AgentModel.Gemini35FlashLite }),
  projectModelFactory.build({ model: AgentModel.Gemini4Argon }),
  projectModelFactory.build({ model: AgentModel.Gemma4_26B }),
  projectModelFactory.build({ model: AgentModel.MedGemma10_27B }),
  projectModelFactory.build({ model: AgentModel.Qwen38_27B }),
  projectModelFactory.build({
    model: AgentModel.ClaudeSonnet55,
    selfHosted: false,
    enabled: false,
  }),
  projectModelFactory.build({
    model: AgentModel.Gpt54,
    selfHosted: false,
    enabled: false,
    servedOutsideEu: true,
  }),
]

const meta = {
  title: "workspace-models/WorkspaceModelsSection",
  component: WorkspaceModelsSection,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Demo workspace · Models</h1>
          <p className="text-muted-foreground">Backoffice page of a workspace.</p>
        </div>
        <Story />
      </div>
    ),
  ],
  args: {
    models: codeModels,
    customModels: [],
    types: buildCustomModelTypes(),
    canUpdate: true,
    onToggle: fn(),
    onReset: fn(),
    onCreate: fn(async () => true),
    onUpdate: fn(async () => true),
    onDelete: fn(),
  },
} satisfies Meta<typeof WorkspaceModelsSection>

export default meta
type Story = StoryObj<typeof meta>

/** A new workspace: the defaults of the code, nothing added. */
export const Defaults: Story = {}

/** Gemma turned on, and two models added: one already used by agents, one not yet. */
export const WithAddedModels: Story = {
  args: {
    models: codeModels.map((model) =>
      model.model === AgentModel.Gemma4_26B ? { ...model, enabled: true, customized: true } : model,
    ),
    customModels: [
      customModelFactory.build({
        name: "Gemma 4 on the new server",
        baseModel: AgentModel.Gemma4_26B,
        baseUrl: "https://gpu-2.example.org/v1",
        agentCount: 3,
      }),
      customModelFactory.build({
        name: "Qwen test",
        baseModel: AgentModel.Qwen38_27B,
        baseUrl: "https://qwen.example.org/v1",
        hasApiKey: false,
        servedModelName: "qwen-test",
      }),
    ],
  },
}

/** Someone who may read the backoffice but not set the models. */
export const ReadOnly: Story = {
  args: {
    ...WithAddedModels.args,
    canUpdate: false,
  },
}
