import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  maintenanceJobFactory,
  maintenanceJobRunFactory,
} from "@/backoffice/features/backoffice/backoffice.factory"
import type { MaintenanceJob } from "@/backoffice/features/backoffice/backoffice.models"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { BackofficeMaintenanceJobsRoutes } from "@/backoffice/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  type BackofficeStoryArgs,
  backofficeStoryArgs,
  backofficeStoryArgTypes,
  buildBackofficeData,
  buildMockBackofficeService,
} from "@/stories/routes/backoffice/helpers"
import { mergeSeeds, seed } from "@/stories/seed"

type LastRunState = "never" | "waiting" | "active" | "completed" | "failed"

type StoryArgs = BackofficeStoryArgs & {
  withMaintenanceJobs: boolean
  lastRun: LastRunState
  nothingLeft: boolean
}

function buildMaintenanceJobs(args: StoryArgs): MaintenanceJob[] {
  if (!args.withMaintenanceJobs) return []
  return [
    maintenanceJobFactory.build({
      remainingCount: args.nothingLeft ? 0 : 8,
      remainingSummary: args.nothingLeft ? "0 records in 0 projects" : "8 records in 3 projects",
      lastRun:
        args.lastRun === "never" ? null : maintenanceJobRunFactory.build({ state: args.lastRun }),
    }),
  ]
}

const decorator = buildDecorator<StoryArgs>((args) => {
  const { baseSeeds, organizations, users } = buildBackofficeData(args)
  const maintenanceJobs = buildMaintenanceJobs(args)
  return {
    state: mergeSeeds(baseSeeds, seed.backoffice.maintenanceJobs(maintenanceJobs)),
    services: {
      backoffice: buildMockBackofficeService({ organizations, users, maintenanceJobs }),
    },
  }
})

const meta = {
  title: "routes/backoffice/maintenance-jobs",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...backofficeStoryArgTypes,
    withMaintenanceJobs: { control: "boolean" },
    lastRun: {
      control: "select",
      options: ["never", "waiting", "active", "completed", "failed"],
    },
    nothingLeft: { control: "boolean" },
  },
  args: {
    ...backofficeStoryArgs,
    isMaintenanceJobRunAuthorized: true,
    withMaintenanceJobs: true,
    lastRun: "never",
    nothingLeft: false,
  },
  decorators: [decorator],
  render: render({
    path: BackofficeMaintenanceJobsRoutes.maintenanceJobs.path,
    routes: backofficeRoutes,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const NeverRun: Story = {}

export const Running: Story = {
  args: { lastRun: "active" },
}

export const Completed: Story = {
  args: { lastRun: "completed", nothingLeft: true },
}

export const Failed: Story = {
  args: { lastRun: "failed" },
}

export const NoJob: Story = {
  args: { withMaintenanceJobs: false },
}
