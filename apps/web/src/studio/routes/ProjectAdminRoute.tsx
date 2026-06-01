import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { ProjectAdminPage } from "../features/project-admin/components/ProjectAdminPage"

export function ProjectAdminRoute() {
  const project = useAppSelector(selectCurrentProjectData)

  return (
    <AsyncRoute data={[project]}>
      <ProjectAdminPage />
    </AsyncRoute>
  )
}
