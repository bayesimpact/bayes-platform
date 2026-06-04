import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@caseai-connect/ui/shad/card"
import { LayoutGridIcon, PencilIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Grid, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { EditOrganizationDialog } from "@/common/components/organization/EditOrganizationDialog"
import { OrganizationCreator } from "@/common/components/organization/OrganizationCreator"
import { SidebarLayout } from "@/common/components/sidebar/SidebarLayout"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { selectOrganizationsData } from "@/common/features/organizations/organizations.selectors"
import { useAppSelector } from "@/common/store/hooks"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import { ProjectCreatorButton } from "@/studio/features/projects/components/ProjectCreator"
import { PendingInvitationList } from "../components/home/PendingInvitationList"
import {
  SearchWorkspaces,
  SearchWorkspacesInput,
  SearchWorkspacesResults,
} from "../components/home/SearchWorkspaces"
import { WorkspaceItem } from "../components/home/WorkspaceItem"
import { Wrap } from "../components/layouts/Wrap"
import { Logo } from "../components/themes/Logo"
import type { User } from "../features/me/me.models"
import { selectMe, selectPendingInvitations } from "../features/me/me.selectors"
import { useAbility } from "../hooks/use-ability"
import { useValue } from "../hooks/use-value"
import { AsyncRoute } from "./AsyncRoute"

export function OnboardingRoute() {
  const user = useAppSelector(selectMe)
  const organizations = useAppSelector(selectOrganizationsData)
  const invitations = useAppSelector(selectPendingInvitations)
  return (
    <AsyncRoute data={[user, organizations, invitations]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const user = useValue(selectMe)
  const organizations = useValue(selectOrganizationsData)
  const invitations = useValue(selectPendingInvitations)
  const orgsCount = organizations.length
  const hasPendingInvitations = invitations.length > 0
  if (orgsCount === 0 && !hasPendingInvitations) return <OrganizationCreator />

  return (
    <SidebarLayout defaultOpen={false} hideIcon user={{ name: user.name, email: user.email }}>
      <Main
        organizations={organizations}
        user={user}
        orgsCount={orgsCount}
        invitations={invitations}
      />
    </SidebarLayout>
  )
}

function Main({
  organizations,
  user,
  orgsCount: _orgsCount,
  invitations,
}: {
  organizations: Organization[]
  user: User
  orgsCount: number
  invitations: PendingInvitations
}) {
  const { t } = useTranslation()

  const hasPendingInvitations = invitations.length > 0

  return (
    <SearchWorkspaces organizations={organizations}>
      <div className="flex flex-col">
        <Wrap className="mb-0 md:mb-0">
          <GridHeader
            className="border-none"
            title={
              <div className="flex items-center gap-4">
                <div className="size-8">
                  <Logo />
                </div>
                {t("organization:list:title", { name: user.name })}
              </div>
            }
            action={<SearchWorkspacesInput />}
          />
        </Wrap>

        {hasPendingInvitations && (
          <Wrap className="mb-0 md:mb-0">
            <PendingInvitationList invitations={invitations} />
          </Wrap>
        )}

        <SearchWorkspacesResults>
          {(filteredOrganizations) => (
            <Wrap className="border-none md:border-none overflow-visible flex flex-col gap-12">
              {filteredOrganizations.map((organization) => (
                <OrganizationItem key={organization.id} organization={organization} />
              ))}
            </Wrap>
          )}
        </SearchWorkspacesResults>
      </div>
    </SearchWorkspaces>
  )
}

function OrganizationItem({ organization }: { organization: Organization }) {
  const { abilities } = useAbility()
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const canCreateProject = abilities.canCreateProject({
    organizationId: organization.id,
  })
  const canRename = abilities.canRenameOrganization({ organizationId: organization.id })

  if (!canCreateProject && organization.projects.length === 0) return null
  return (
    <Card className="shadow-none bg-muted/20">
      <CardHeader className="mx-2">
        <CardTitle>
          <div className="flex items-center gap-2">
            {organization.name}
            {canRename && (
              <Button variant="ghost" size="icon-sm" onClick={() => setIsRenameDialogOpen(true)}>
                <PencilIcon className="size-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        <CardAction>
          {organization.projects.length > 1 && (
            <div className="flex gap-2 ">
              <Badge variant="outline" className="rounded-full">
                {organization.projects.length}
              </Badge>
              <LayoutGridIcon className="text-muted-foreground" />
            </div>
          )}
        </CardAction>
      </CardHeader>

      <CardContent>
        <Grid cols={2}>
          <GridContent className="bg-white rounded-2xl border">
            {organization.projects.map((project) => (
              <WorkspaceItem key={project.id} organization={organization} project={project} />
            ))}

            {canCreateProject && <ProjectCreatorButton organization={organization} />}
          </GridContent>
        </Grid>

        {canRename && (
          <EditOrganizationDialog
            open={isRenameDialogOpen}
            onClose={() => setIsRenameDialogOpen(false)}
            organization={organization}
          />
        )}
      </CardContent>
    </Card>
  )
}
