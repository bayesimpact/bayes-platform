import { Button } from "@bayes-platform/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bayes-platform/ui/shad/dropdown-menu"
import { cn } from "@bayes-platform/ui/utils"
import type { TFunction } from "i18next"
import {
  ArrowRightIcon,
  ChevronDownIcon,
  FlaskConicalIcon,
  LayoutGridIcon,
  SettingsIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { GridCard } from "@/common/components/grid/Grid"
import type { OrganizationWithProjects } from "@/common/features/organizations/organizations.selectors"
import type { MyProject } from "@/common/features/projects/projects.models"
import { useAbility } from "@/common/hooks/use-ability"
import { DeskRoutes } from "@/common/routes/desk-routes"
import { EvalRoutes } from "@/common/routes/eval-routes"
import { toAppHref } from "@/config/runtime-config"
import { StudioRoutes } from "@/studio/routes/helpers"

export function WorkspaceItem({
  organization,
  project,
}: {
  organization: OrganizationWithProjects
  project: MyProject
}) {
  const apps = useAvailableApps({ organizationId: organization.id, project })
  const singleProject = organization.projects.length === 1
  return (
    <GridCard key={project.id}>
      <GridCard.Body>
        <div className="flex justify-between items-center">
          <GridCard.Title className={cn(!singleProject && "pb-4")}>{project.name}</GridCard.Title>
          {singleProject && <OpenButton apps={apps} />}
        </div>
        {!singleProject && <OpenButton apps={apps} />}
      </GridCard.Body>
    </GridCard>
  )
}

type AppName = "desk" | "studio" | "eval" | "campaigns"
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
      <Button variant="outline" onClick={() => window.location.assign(toAppHref(app.path))}>
        {app.icon} {app.name} <ArrowRightIcon className="ml-4" />
      </Button>
    )
  }

  const canAccessStudio = apps.some((app) => app.id === "studio")

  const firstApp = canAccessStudio
    ? apps.find((app) => app.id === "studio")
    : (apps.find((app) => app.id === "desk") ?? apps[0])

  const filteredApps = apps.filter((app) => app !== firstApp)

  if (!firstApp) return null
  return (
    <DropdownMenu>
      <div>
        <Button
          variant="outline"
          onClick={() => window.location.assign(toAppHref(firstApp.path))}
          className="rounded-r-none"
        >
          {firstApp.icon} {firstApp.name} <div className="w-2" />
        </Button>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="select-none rounded-l-none border-l-0">
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuGroup>
          {filteredApps.map((app) => {
            return (
              <DropdownMenuItem
                key={app.id}
                onClick={() => window.location.assign(toAppHref(app.path))}
              >
                {app.icon} {app.name}
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
  project: MyProject
}): AppData[] {
  const { t } = useTranslation()
  const { abilities } = useAbility()

  const apps: AppData[] = []

  if (abilities.canAccessDesk({ projectId: project.id }))
    apps.push(getAppData({ app: "desk", organizationId, projectId: project.id, t }))

  if (abilities.canAccessStudio({ projectId: project.id }))
    apps.push(getAppData({ app: "studio", organizationId, projectId: project.id, t }))

  const takesPartInCampaign =
    abilities.canAccessTester({ projectId: project.id }) ||
    abilities.canAccessReviewer({ projectId: project.id })

  if (abilities.canAccessEvaluation({ projectId: project.id })) {
    apps.push(getAppData({ app: "eval", organizationId, projectId: project.id, t }))
  } else if (takesPartInCampaign) {
    // A person who only tests or reviews a campaign may have no agent in the Evaluation app: its
    // home opens their campaign, where the project's URL would find nothing.
    apps.push(getAppData({ app: "campaigns", organizationId, projectId: project.id, t }))
  }

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
    case "campaigns":
      return {
        id: "campaigns",
        path: EvalRoutes.home.path,
        name: t("actions:goToEval"),
        icon: <FlaskConicalIcon />,
      }
  }
}
