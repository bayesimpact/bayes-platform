import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import type { TFunction } from "i18next"
import {
  ArrowRightIcon,
  ChevronDownIcon,
  FlaskConicalIcon,
  HatGlassesIcon,
  LayoutGridIcon,
  ListChecksIcon,
  SettingsIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { GridItem } from "@/common/components/grid/Grid"
import { selectMyActiveReviewCampaignMemberships } from "@/common/features/me/me.selectors"
import type { Organization } from "@/common/features/organizations/organizations.models"
import type { Project } from "@/common/features/projects/projects.models"
import { useAbility } from "@/common/hooks/use-ability"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useAppSelector } from "@/common/store/hooks"
import { DeskRoutes } from "@/desk/routes/helpers"
import { EvalRoutes } from "@/eval/routes/helpers"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"
import { StudioRoutes } from "@/studio/routes/helpers"
import { TesterRoutes } from "@/tester/routes/helpers"

export function WorkspaceItem({
  organization,
  project,
  index,
}: {
  organization: Organization
  project: Project
  index: number
}) {
  const apps = useAvailableApps({ organizationId: organization.id, project })
  if (organization.projects.length === 1)
    return (
      <GridItem
        key={project.id}
        index={index}
        title={project.name}
        action
        middleAction={<OpenButton apps={apps} />}
      />
    )
  return (
    <GridItem
      description
      key={project.id}
      index={index}
      title={project.name}
      action={<OpenButton apps={apps} />}
    />
  )
}

type AppName = "desk" | "studio" | "eval" | "tester" | "reviewer"
type AppData = {
  id: AppName
  path: string
  name: string
  icon: React.ReactNode
}
function OpenButton({ apps }: { apps: AppData[] }) {
  if (apps.length === 1) {
    const app = apps[0]
    if (!app) return null
    return (
      <Button variant="outline" onClick={() => window.location.assign(app.path)}>
        {app.icon} {app.name} <ArrowRightIcon className="ml-4" />
      </Button>
    )
  }

  const canAccessStudio = apps.some((app) => app.id === "studio")

  const firstApp = canAccessStudio
    ? apps.find((app) => app.id === "studio")
    : apps.find((app) => app.id === "desk")

  const filteredApps = canAccessStudio
    ? apps.filter((app) => app.id !== "studio")
    : apps.filter((app) => app.id !== "desk")

  if (!firstApp) return null
  return (
    <DropdownMenu>
      <Button
        variant="outline"
        onClick={() => window.location.assign(firstApp.path)}
        className="rounded-r-none "
      >
        {firstApp.icon} {firstApp.name} <div className="w-2" />
      </Button>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="select-none rounded-l-none border-l-0">
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuGroup>
          {filteredApps.map((app) => {
            return (
              <DropdownMenuItem key={app.id} asChild>
                <Link to={app.path}>
                  {app.icon} {app.name}
                </Link>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function useAvailableApps({
  organizationId,
  project,
}: {
  organizationId: string
  project: Project
}): AppData[] {
  const { t } = useTranslation()
  const { abilities } = useAbility()
  const { hasFeature } = useFeatureFlags(project)
  const testerMemberships = useAppSelector(selectMyActiveReviewCampaignMemberships("tester"))
  const hasTesterCampaignInProject = testerMemberships.some((m) => m.projectId === project.id)
  const reviewerMemberships = useAppSelector(selectMyActiveReviewCampaignMemberships("reviewer"))
  const hasReviewerCampaignInProject = reviewerMemberships.some((m) => m.projectId === project.id)

  const desk = getAppData({ app: "desk", organizationId, projectId: project.id, t })
  const apps: AppData[] = [desk]

  if (abilities.canAccessStudio({ projectId: project.id }))
    apps.push(getAppData({ app: "studio", organizationId, projectId: project.id, t }))

  if (hasFeature("evaluation"))
    apps.push(getAppData({ app: "eval", organizationId, projectId: project.id, t }))

  if (hasTesterCampaignInProject)
    apps.push(getAppData({ app: "tester", organizationId, projectId: project.id, t }))

  if (hasReviewerCampaignInProject)
    apps.push(getAppData({ app: "reviewer", organizationId, projectId: project.id, t }))

  return apps
}

function getAppData({
  app,
  organizationId,
  projectId,
  t,
}: {
  app: AppName
  organizationId: string
  projectId: string
  t: TFunction
}): AppData {
  switch (app) {
    case "desk":
      return {
        id: "desk",
        path: DeskRoutes.project.build({ organizationId, projectId }),
        name: t("actions:goToApp"),
        icon: <LayoutGridIcon />,
      }
    case "studio":
      return {
        id: "studio",
        path: StudioRoutes.project.build({ organizationId, projectId }),
        name: t("actions:goToStudio"),
        icon: <SettingsIcon />,
      }
    case "eval":
      return {
        id: "eval",
        path: EvalRoutes.project.build({ organizationId, projectId }),
        name: t("actions:goToEval"),
        icon: <FlaskConicalIcon />,
      }
    case "tester":
      return {
        id: "tester",
        path: TesterRoutes.home.path,
        name: t("actions:goToTester"),
        icon: <ListChecksIcon />,
      }
    case "reviewer":
      return {
        id: "reviewer",
        path: ReviewerRoutes.home.path,
        name: t("actions:goToReviewer"),
        icon: <HatGlassesIcon />,
      }
  }
}
