import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { evaluationReportFactory } from "@/studio/features/evaluation-reports/evaluation-reports.factory"
import type { EvaluationReport } from "@/studio/features/evaluation-reports/evaluation-reports.models"
import { evaluationFactory } from "@/studio/features/evaluations/evaluations.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withEvaluations?: boolean
  withEvaluationReports?: boolean
}

const meta = {
  title: "routes/studio/project/evaluation",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withEvaluations: { control: "boolean" },
    withEvaluationReports: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "evaluation"],
    withEvaluations: false,
    withEvaluationReports: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.evaluation.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withEvaluations, withEvaluationReports, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const evaluations = withEvaluations
        ? evaluationFactory.transient({ project }).buildList(3)
        : []
      const reportsByEvaluationId = withEvaluationReports
        ? evaluations.reduce<Record<string, EvaluationReport[]>>((acc, evaluation) => {
            acc[evaluation.id] = agents.map((agent) =>
              evaluationReportFactory.transient({ evaluation, agent }).build(),
            )
            return acc
          }, {})
        : {}
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.studio.evaluations(evaluations),
          seed.studio.evaluationReports(reportsByEvaluationId),
        ),
      }
    }),
  ],
}
