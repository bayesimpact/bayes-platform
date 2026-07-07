import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import {
  selectProjectMemberships,
  selectProjectPendingInvitations,
} from "@/studio/features/project-memberships/project-memberships.selectors"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { ProjectMembershipList } from "../features/project-memberships/components/ProjectMembershipList"
import { projectMembershipsActions } from "../features/project-memberships/project-memberships.slice"

export function ProjectMembershipsRoute() {
  const projectId = useCurrentId(selectCurrentProjectId)
  const memberships = useAppSelector(selectProjectMemberships)
  const pendingInvitations = useAppSelector(selectProjectPendingInvitations)

  useMount({
    actions: projectMembershipsActions,
    refreshOn: [projectId],
  })

  return (
    <AsyncRoute data={[memberships, pendingInvitations]}>
      <ProjectMembershipList />
    </AsyncRoute>
  )
}
