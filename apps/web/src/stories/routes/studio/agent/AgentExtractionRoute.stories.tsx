import { MimeTypes } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { documentFactory } from "@/studio/features/documents/documents.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  /**
   * Whether the agent has an unpublished draft, which the picker defaults to. With this off, only
   * one version exists, so `AgentSettingsVersionSelect` early-returns and the picker disappears
   * entirely — that is expected, not a regression.
   */
  withPendingDraft?: boolean
  /** Whether documents are seeded for the uploader's document list (its selectable table). */
  withDocuments?: boolean
}

const meta = {
  title: "routes/studio/project/agent/extraction",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    withPendingDraft: { control: "boolean" },
    withDocuments: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    withPendingDraft: true,
    withDocuments: true,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentExtraction.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

/** One decorator body for every story; `chosenRevision` is the only thing that varies. */
const buildExtractionDecorator = (chosenRevision?: number) =>
  buildDecorator<StoryArgs>(({ withPendingDraft, withDocuments, ...args }) => {
    const { baseSeeds, project, agents } = buildStudioData(args)
    const [firstAgent, ...restAgents] = agents
    const currentAgent = agentFactory.transient({ project }).build({
      ...firstAgent,
      type: "extraction",
      currentRevision: { number: 1 },
      draftRevision: withPendingDraft ? { number: 2 } : undefined,
    })
    const versions = [
      ...(withPendingDraft
        ? [
            agentSettingsFactory
              .transient({ agent: currentAgent })
              .build({ revision: 2, isDraft: true, name: "Stricter title rules" }),
          ]
        : []),
      agentSettingsFactory.transient({ agent: currentAgent }).build({ revision: 1 }),
    ]
    const documents = withDocuments
      ? ["sample-report.pdf", "invoice-2024-03.pdf", "contract-scan.pdf"].map((fileName) =>
          documentFactory.transient({ project }).build({ fileName, mimeType: MimeTypes.pdf }),
        )
      : []

    return {
      state: mergeSeeds(
        baseSeeds,
        seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
        seed.extractionAgentSessions({
          [currentAgent.id]: { csvSessions: [], others: [] },
        }),
        seed.extractionAgentSessionDocuments(documents),
        seed.studio.agentHistory({ agentId: currentAgent.id, versions }),
        ...(chosenRevision === undefined
          ? []
          : [
              seed.studio.playgroundRevision({
                agentId: currentAgent.id,
                revision: chosenRevision,
              }),
            ]),
      ),
    }
  })

/** No explicit choice, so the picker falls to the draft-first default. */
export const Default: Story = {
  decorators: [buildExtractionDecorator()],
}

/** An explicit choice of the published version wins over the draft default. */
export const PublishedChosen: Story = {
  decorators: [buildExtractionDecorator(1)],
}
