import { Button } from "@caseai-connect/ui/shad/button"
import { useSidebar } from "@caseai-connect/ui/shad/sidebar"
import { CheckCircleIcon } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import { OrganizationCreator } from "@/common/components/organization/OrganizationCreator"
import { SidebarLayout } from "@/common/components/sidebar/SidebarLayout"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { selectOrganizationsData } from "@/common/features/organizations/organizations.selectors"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { DeskRoutes } from "@/desk/routes/helpers"
import { EvalRoutes } from "@/eval/routes/helpers"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"
import { acceptInvitation } from "@/studio/features/invitations/invitations.thunks"
import { ProjectCreatorButton } from "@/studio/features/projects/components/ProjectCreator"
import { StudioRoutes } from "@/studio/routes/helpers"
import { TesterRoutes } from "@/tester/routes/helpers"
import { Wrap } from "../components/layouts/Wrap"
import type {
  PendingAgentInvitation,
  PendingInvitations,
  PendingProjectInvitation,
  User,
} from "../features/me/me.models"
import {
  selectMe,
  selectMyActiveReviewCampaignMemberships,
  selectPendingInvitations,
} from "../features/me/me.selectors"
import type { Project } from "../features/projects/projects.models"
import { useAbility } from "../hooks/use-ability"
import { useFeatureFlags } from "../hooks/use-feature-flags"
import { buildSince } from "../utils/build-date"
import { AsyncRoute } from "./AsyncRoute"

export function OnboardingRoute() {
  const user = useAppSelector(selectMe)
  const organizations = useAppSelector(selectOrganizationsData)
  const invitations = useAppSelector(selectPendingInvitations)
  return (
    <AsyncRoute data={[user, organizations, invitations]}>
      {([userValue, organizationsValue, invitationsValue]) => (
        <WithData
          user={userValue}
          organizations={organizationsValue}
          invitations={invitationsValue}
        />
      )}
    </AsyncRoute>
  )
}

function WithData({
  user,
  organizations,
  invitations,
}: {
  user: User
  organizations: Organization[]
  invitations: PendingInvitations
}) {
  const orgsCount = organizations.length
  const hasPendingInvitations =
    invitations.projectInvitations.length > 0 || invitations.agentInvitations.length > 0
  if (orgsCount === 0 && !hasPendingInvitations) return <OrganizationCreator />

  return (
    <SidebarLayout hideIcon user={{ name: user.name, email: user.email }}>
      <SidebarContent
        organizations={organizations}
        user={user}
        orgsCount={orgsCount}
        invitations={invitations}
      />
    </SidebarLayout>
  )
}

function SidebarContent({
  organizations,
  user,
  orgsCount,
  invitations,
}: {
  organizations: Organization[]
  user: User
  orgsCount: number
  invitations: PendingInvitations
}) {
  const { t } = useTranslation()
  const { setOpen } = useSidebar()
  useEffect(() => {
    setOpen(false)
  }, [setOpen])
  const hasPendingInvitations =
    invitations.projectInvitations.length > 0 || invitations.agentInvitations.length > 0
  return (
    <div className="flex flex-col">
      <Wrap>
        <Grid cols={1} total={orgsCount}>
          <GridHeader title={t("organization:list:title", { name: user.name })} />

          {hasPendingInvitations && (
            <div className="m-6 border rounded-2xl overflow-hidden">
              <PendingInvitationList invitations={invitations} />
            </div>
          )}

          <GridContent>
            {organizations.map((organization, index) => (
              <OrganizationItem key={organization.id} organization={organization} index={index} />
            ))}
          </GridContent>
        </Grid>
      </Wrap>
    </div>
  )
}

function PendingInvitationList({ invitations }: { invitations: PendingInvitations }) {
  const { t } = useTranslation()
  const { projectInvitations, agentInvitations } = invitations
  const total = projectInvitations.length + agentInvitations.length
  if (total === 0) return null
  return (
    <Grid cols={3} total={total}>
      <GridHeader title={t("me:invitations:title")} description={t("me:invitations:description")} />

      <GridContent>
        {projectInvitations.map((invitation, index) => (
          <PendingProjectInvitationItem key={invitation.id} invitation={invitation} index={index} />
        ))}

        {agentInvitations.map((invitation, index) => (
          <PendingAgentInvitationItem
            key={invitation.id}
            invitation={invitation}
            index={projectInvitations.length + index}
          />
        ))}
      </GridContent>
    </Grid>
  )
}

function PendingProjectInvitationItem({
  invitation,
  index,
}: {
  invitation: PendingProjectInvitation
  index: number
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const handleClick = () => {
    dispatch(acceptInvitation({ ticketId: invitation.invitationToken }))
  }
  return (
    <GridItem
      index={index}
      badge={t("me:invitations:projectBadge")}
      title={invitation.projectName}
      description={`${invitation.organizationName} · ${t("me:invitations:roleLabel")}: ${invitation.role}`}
      action={
        <Button onClick={handleClick}>
          {t("actions:accept")} <CheckCircleIcon />
        </Button>
      }
    />
  )
}

function PendingAgentInvitationItem({
  invitation,
  index,
}: {
  invitation: PendingAgentInvitation
  index: number
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const handleClick = () => {
    dispatch(acceptInvitation({ ticketId: invitation.invitationToken }))
  }
  return (
    <GridItem
      index={index}
      badge={t("me:invitations:agentBadge")}
      title={invitation.agentName}
      description={`${invitation.organizationName} · ${invitation.projectName} · ${t("me:invitations:roleLabel")}: ${invitation.role}`}
      action={
        <Button onClick={handleClick}>
          {t("actions:accept")} <CheckCircleIcon />
        </Button>
      }
    />
  )
}

function OrganizationItem({ organization, index }: { organization: Organization; index: number }) {
  const { t } = useTranslation()
  const { abilities } = useAbility()
  const canCreateProject = abilities.canCreateProject({
    organizationId: organization.id,
  })
  const extraItems = canCreateProject ? 1 : 0
  if (!canCreateProject && organization.projects.length === 0) return
  return (
    <GridItem
      className="bg-gray-50"
      index={index}
      title={organization.name}
      description={t("organization:organization")}
      action={
        <Grid cols={2} total={organization.projects.length} extraItems={extraItems}>
          <GridContent className="bg-white rounded-2xl border">
            {organization.projects.map((project, index) => (
              <GridItem
                badge={t("project:project")}
                key={project.id}
                index={index}
                title={project.name}
                description={buildSince(project.createdAt)}
                action={
                  <div className="flex items-center gap-2 flex-wrap">
                    <NavAppButton organizationId={organization.id} projectId={project.id} />

                    <NavStudioButton organizationId={organization.id} projectId={project.id} />

                    <NavEvalButton organizationId={organization.id} project={project} />

                    <NavTesterButton projectId={project.id} />

                    <NavReviewerButton projectId={project.id} />
                  </div>
                }
              />
            ))}

            {canCreateProject && (
              <ProjectCreatorButton
                index={organization.projects.length}
                organization={organization}
              />
            )}
          </GridContent>
        </Grid>
      }
    />
  )
}

function NavAppButton({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation()

  const handleClick = () => {
    const path = DeskRoutes.project.build({
      organizationId,
      projectId,
    })
    // NOTE: do not use navigate from react-router
    window.location.assign(path)
  }

  return (
    <Button variant="outline" onClick={handleClick}>
      {t("actions:goToApp")}
    </Button>
  )
}

function NavStudioButton({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation()
  const { abilities } = useAbility()
  const canAccessStudio = abilities.canAccessStudio({ projectId })

  const handleClick = () => {
    const path = StudioRoutes.project.build({
      organizationId,
      projectId,
    })
    // NOTE: do not use navigate from react-router
    window.location.assign(path)
  }

  if (!canAccessStudio) return null
  return (
    <Button variant="outline" onClick={handleClick}>
      {t("actions:goToStudio")}
    </Button>
  )
}

function NavEvalButton({ organizationId, project }: { organizationId: string; project: Project }) {
  const { t } = useTranslation()
  const { hasFeature } = useFeatureFlags(project)

  const handleClick = () => {
    const path = EvalRoutes.project.build({
      organizationId,
      projectId: project.id,
    })
    // NOTE: do not use navigate from react-router
    window.location.assign(path)
  }

  if (!hasFeature("evaluation")) return null
  return (
    <Button variant={"outline"} onClick={handleClick}>
      {t("actions:goToEval")}
    </Button>
  )
}

function NavTesterButton({ projectId }: { projectId: string }) {
  // Reads from /me — no extra round-trip on Onboarding.
  const memberships = useAppSelector(selectMyActiveReviewCampaignMemberships("tester"))
  const hasTesterCampaignInProject = memberships.some((m) => m.projectId === projectId)

  const handleClick = () => {
    // NOTE: do not use navigate from react-router — tester is its own route tree
    window.location.assign(TesterRoutes.home.path)
  }

  if (!hasTesterCampaignInProject) return null
  return (
    <Button variant="outline" onClick={handleClick}>
      Test
    </Button>
  )
}

function NavReviewerButton({ projectId }: { projectId: string }) {
  const memberships = useAppSelector(selectMyActiveReviewCampaignMemberships("reviewer"))
  const hasReviewerCampaignInProject = memberships.some((m) => m.projectId === projectId)

  const handleClick = () => {
    // NOTE: do not use navigate from react-router — reviewer is its own route tree
    window.location.assign(ReviewerRoutes.home.path)
  }

  if (!hasReviewerCampaignInProject) return null
  return (
    <Button variant="outline" onClick={handleClick}>
      Review
    </Button>
  )
}
