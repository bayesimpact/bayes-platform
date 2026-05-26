import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import {
  selectProjectMemberships,
  selectProjectPendingInvitations,
} from "@/studio/features/project-memberships/project-memberships.selectors"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { ProjectMembershipList } from "../features/project-memberships/components/ProjectMembershipList"

export function ProjectMembershipsRoute() {
  const project = useAppSelector(selectCurrentProjectData)
  const memberships = useAppSelector(selectProjectMemberships)
  const pendingInvitations = useAppSelector(selectProjectPendingInvitations)

  // TODO: useMount to load pending invitations and memberships if not loaded yet

  return (
    <AsyncRoute data={[memberships, project, pendingInvitations]}>
      <ProjectMembershipList />
    </AsyncRoute>
  )
}
