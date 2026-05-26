import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import {
  selectIsBackofficeAuthorized,
  selectIsTermsManagementAuthorized,
} from "@/common/features/me/me.selectors"
import { useInitStore } from "@/common/hooks/use-init-store"
import { useMount } from "@/common/hooks/use-mount"
import { RouteNames } from "@/common/routes/helpers"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { useAppSelector } from "@/common/store/hooks"
import { backofficeActions } from "../features/backoffice/backoffice.slice"
import { OrganizationsPanel } from "../features/backoffice/components/OrganizationsPanel"
import { TermsDocumentsPanel } from "../features/backoffice/components/TermsDocumentsPanel"
import { UsersPanel } from "../features/backoffice/components/UsersPanel"
import { injectBackofficeSlices, resetBackofficeSlices } from "../store/slices"

type TabValue = "organizations" | "users" | "termsDocuments"

export function BackofficeRoute() {
  const isAuthorized = useAppSelector(selectIsBackofficeAuthorized)
  const { initDone } = useInitStore({
    inject: injectBackofficeSlices,
    reset: resetBackofficeSlices,
    condition: isAuthorized,
  })

  if (!isAuthorized) return <NotFoundRoute />
  if (initDone) return <Route />
  return <LoadingRoute />
}

function Route() {
  const canManageTerms = useAppSelector(selectIsTermsManagementAuthorized)

  useMount({ actions: backofficeActions })

  return <WithData canManageTerms={canManageTerms} />
}

function WithData({ canManageTerms }: { canManageTerms: boolean }) {
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
            {canManageTerms && <TabsTrigger value="termsDocuments">Terms & Compliance</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="organizations">
          <OrganizationsPanel />
        </TabsContent>
        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>

        {canManageTerms && (
          <TabsContent value="termsDocuments">
            <TermsDocumentsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
