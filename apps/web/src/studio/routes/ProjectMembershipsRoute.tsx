import { Input } from "@caseai-connect/ui/shad/input"
import { SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import type { Project } from "@/common/features/projects/projects.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useGetPath } from "@/common/hooks/use-build-path"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { PendingInvitationsSection } from "@/studio/features/invitations/components/PendingInvitationsSection"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import { revokeInvitation } from "@/studio/features/invitations/invitations.thunks"
import { MembersCreator } from "@/studio/features/project-memberships/components/MembersCreator"
import { ProjectMembershipItem } from "@/studio/features/project-memberships/components/ProjectMembershipItem"
import type { ProjectMembership } from "@/studio/features/project-memberships/project-memberships.models"
import {
  selectProjectMemberships,
  selectProjectPendingInvitations,
} from "@/studio/features/project-memberships/project-memberships.selectors"
import { AsyncRoute } from "../../common/routes/AsyncRoute"

export function ProjectMembershipsRoute() {
  const project = useAppSelector(selectCurrentProjectData)
  const memberships = useAppSelector(selectProjectMemberships)
  const pendingInvitations = useAppSelector(selectProjectPendingInvitations)

  return (
    <AsyncRoute data={[memberships, project, pendingInvitations]}>
      {([membershipsValue, projectValue, pendingInvitationsValue]) => (
        <WithData
          memberships={membershipsValue}
          project={projectValue}
          pendingInvitations={pendingInvitationsValue}
        />
      )}
    </AsyncRoute>
  )
}

function WithData({
  memberships,
  project,
  pendingInvitations,
}: {
  memberships: ProjectMembership[]
  project: Project
  pendingInvitations: PendingInvitations
}) {
  const outlet = useOutlet()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const { getPath } = useGetPath()
  const handleBack = () => {
    const path = getPath("project")
    navigate(path)
  }

  const filteredMemberships = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return memberships
    return memberships.filter((membership) => {
      const userName = membership.userName?.toLowerCase() ?? ""
      const userEmail = membership.userEmail.toLowerCase()
      return userName.includes(query) || userEmail.includes(query)
    })
  }, [memberships, searchQuery])

  const cols = filteredMemberships.length === 0 ? 0 : 3
  const total = filteredMemberships.length
  const handleRevokeInvitation = (invitationId: string) => {
    void dispatch(
      revokeInvitation({
        invitationId,
        refreshTarget: { targetType: "project", targetId: project.id },
      }),
    )
  }

  if (outlet) return outlet
  return (
    <>
      <Grid cols={cols} total={total} extraItems={1}>
        <GridHeader
          onBack={handleBack}
          title={t("projectMembership:list.title", { projectName: project.name })}
          description={t("projectMembership:list.description")}
          action={<Search value={searchQuery} onChange={setSearchQuery} />}
        />

        <GridContent>
          {filteredMemberships.map((membership, index) => (
            <ProjectMembershipItem
              organizationId={project.organizationId}
              index={index}
              key={membership.id}
              membership={membership}
            />
          ))}

          <GridItem
            index={total}
            title={t("projectMembership:create.title")}
            description={t("projectMembership:create.description")}
            action={<MembersCreator projectId={project.id} />}
            className="bg-muted/35"
          />
        </GridContent>
      </Grid>
      <PendingInvitationsSection
        invitations={pendingInvitations}
        title={t("projectMembership:pendingInvitations.title")}
        description={t("projectMembership:pendingInvitations.description")}
        onRevoke={handleRevokeInvitation}
      />
    </>
  )
}

function Search({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="relative max-w-sm">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        className="pl-8 min-w-60"
        placeholder={t("projectMembership:list.searchPlaceholder")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="search"
      />
    </div>
  )
}
