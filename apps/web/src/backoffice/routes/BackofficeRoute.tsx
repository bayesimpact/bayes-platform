import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  selectBackofficeOrganizations,
  selectBackofficeUsers,
  selectTermsDocuments,
} from "@/backoffice/features/backoffice/backoffice.selectors"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectIsTermsManagementAuthorized } from "@/common/features/me/me.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { RouteNames } from "@/common/routes/helpers"
import { useAppSelector } from "@/common/store/hooks"
import type {
  PaginatedBackofficeOrganizations,
  PaginatedBackofficeUsers,
  TermsDocuments,
} from "../features/backoffice/backoffice.models"
import { backofficeActions } from "../features/backoffice/backoffice.slice"
import { OrganizationsPanel } from "../features/backoffice/components/OrganizationsPanel"
import { TermsDocumentsPanel } from "../features/backoffice/components/TermsDocumentsPanel"
import { UsersPanel } from "../features/backoffice/components/UsersPanel"

type TabValue = "organizations" | "users" | "termsDocuments"

export function BackofficeRoute() {
  const organizations = useAppSelector(selectBackofficeOrganizations)
  const users = useAppSelector(selectBackofficeUsers)
  const termsDocuments = useAppSelector(selectTermsDocuments)
  const canManageTerms = useAppSelector(selectIsTermsManagementAuthorized)

  useMount({ actions: backofficeActions })

  if (canManageTerms) {
    return (
      <AsyncRoute data={[organizations, users, termsDocuments]}>
        {([organizationsValue, usersValue, termsDocumentsValue]) => (
          <WithData
            organizations={organizationsValue}
            users={usersValue}
            termsDocuments={termsDocumentsValue}
          />
        )}
      </AsyncRoute>
    )
  }

  return (
    <AsyncRoute data={[organizations, users]}>
      {([organizationsValue, usersValue]) => (
        <WithData organizations={organizationsValue} users={usersValue} termsDocuments={null} />
      )}
    </AsyncRoute>
  )
}

function WithData({
  organizations,
  users,
  termsDocuments,
}: {
  organizations: PaginatedBackofficeOrganizations
  users: PaginatedBackofficeUsers
  termsDocuments: TermsDocuments | null
}) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabValue>("organizations")

  return (
    <div className="w-4/5 lg:w-3/4 mx-auto my-10 relative border rounded-2xl overflow-hidden">
      <GridHeader
        onBack={() => navigate(RouteNames.ONBOARDING)}
        title="Backoffice"
        description="Manage organizations, projects, feature flags, and users"
      />
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        className="gap-0"
      >
        <div className="p-4 border-b">
          <TabsList>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            {termsDocuments && <TabsTrigger value="termsDocuments">Terms & Compliance</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="organizations">
          <OrganizationsPanel organizations={organizations} />
        </TabsContent>
        <TabsContent value="users">
          <UsersPanel users={users} />
        </TabsContent>
        {termsDocuments && (
          <TabsContent value="termsDocuments">
            <TermsDocumentsPanel documents={termsDocuments} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
