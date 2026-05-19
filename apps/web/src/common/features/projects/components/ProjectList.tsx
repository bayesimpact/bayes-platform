import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridContent, GridHeader } from "@/common/components/grid/Grid"
import type { Organization } from "@/common/features/organizations/organizations.models"
import type { Project } from "@/common/features/projects/projects.models"
import { RouteNames } from "@/common/routes/helpers"
import type { DeskRoutes } from "@/desk/routes/helpers"
import type { StudioRoutes } from "@/studio/routes/helpers"
import { ProjectItem } from "./ProjectItem"

type BuildProjectPath = typeof StudioRoutes.project.build | typeof DeskRoutes.project.build
export function ProjectList({
  projects,
  organization,
  children,
  buildProjectPath,
}: {
  children?: React.ReactNode
  projects: Project[]
  organization: Organization
  buildProjectPath: BuildProjectPath
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const handleBack = () => {
    navigate(RouteNames.HOME)
  }
  const cols = projects.length === 1 ? 2 : 3
  return (
    <Grid cols={cols} total={projects.length} extraItems={children ? 1 : 0}>
      <GridHeader
        title={organization.name}
        description={t("project:list.title")}
        onBack={handleBack}
      />

      <GridContent>
        {projects.map((project, index) => (
          <ProjectItem
            index={index}
            key={project.id}
            organizationId={organization.id}
            project={project}
            buildProjectPath={buildProjectPath}
          />
        ))}

        {children}
      </GridContent>
    </Grid>
  )
}
