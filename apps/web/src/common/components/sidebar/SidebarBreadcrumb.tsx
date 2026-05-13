import { Breadcrumb, BreadcrumbList } from "@caseai-connect/ui/shad/breadcrumb"
import { BreadcrumbAgent } from "@/common/components/breadcrumb/BreadcrumbAgent"
import { BreadcrumbAgentAnalytics } from "@/common/components/breadcrumb/BreadcrumbAgentAnalytics"
import { BreadcrumbAgentMembership } from "@/common/components/breadcrumb/BreadcrumbAgentMembership"
import { BreadcrumbAgentSession } from "@/common/components/breadcrumb/BreadcrumbAgentSession"
import { BreadcrumbDocuments } from "@/common/components/breadcrumb/BreadcrumbDocuments"
import { BreadcrumbEvaluations } from "@/common/components/breadcrumb/BreadcrumbEvaluations"
import { BreadcrumbFeedback } from "@/common/components/breadcrumb/BreadcrumbFeedback"
import { BreadcrumbProjectAnalytics } from "@/common/components/breadcrumb/BreadcrumbProjectAnalytics"
import { BreadcrumbProjectMembership } from "@/common/components/breadcrumb/BreadcrumbProjectMembership"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { useBreakpoint } from "@/common/hooks/use-breakpoint"

export function SidebarBreadcrumb({ organization }: { organization: Organization }) {
  const { isShortViewport } = useBreakpoint()
  if (isShortViewport) return null
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbAgent organizationId={organization.id} />

        <BreadcrumbAgentAnalytics />

        <BreadcrumbAgentSession organizationId={organization.id} />

        <BreadcrumbEvaluations />

        <BreadcrumbDocuments />

        <BreadcrumbProjectAnalytics />

        <BreadcrumbProjectMembership />

        <BreadcrumbAgentMembership />

        <BreadcrumbFeedback />
      </BreadcrumbList>
    </Breadcrumb>
  )
}
