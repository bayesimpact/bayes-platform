import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridItem } from "@/common/components/grid/Grid"
import type { Project } from "@/common/features/projects/projects.models"
import { buildSince } from "@/common/utils/build-date"
import type { DeskRoutes } from "@/desk/routes/helpers"
import type { StudioRoutes } from "@/studio/routes/helpers"

type BuildProjectPath = typeof StudioRoutes.project.build | typeof DeskRoutes.project.build
export function ProjectItem({
  project,
  organizationId,
  index,
  buildProjectPath,
}: {
  index: number
  project: Project
  organizationId: string
  buildProjectPath: BuildProjectPath
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const handleClick = () => {
    const path = buildProjectPath({ organizationId, projectId: project.id })
    navigate(path)
  }
  const description = buildSince(project.updatedAt) // FIXME: show number of agents instead of last updated time

  // TODO: footer show agent icons based on type
  return (
    <GridItem
      index={index}
      badge={t("project:project")}
      onClick={handleClick}
      title={project.name}
      description={description}
    />
  )
}
