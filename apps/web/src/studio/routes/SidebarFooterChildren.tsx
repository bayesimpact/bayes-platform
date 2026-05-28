import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/ui/shad/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@caseai-connect/ui/shad/sidebar"
import { cn } from "@caseai-connect/ui/utils"
import {
  BarChart3Icon,
  ChevronRightIcon,
  CloudAlertIcon,
  DatabaseZapIcon,
  FileIcon,
  GlobeIcon,
  ListChecksIcon,
  Loader2Icon,
  MegaphoneIcon,
  UsersIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import type { Project } from "@/common/features/projects/projects.models"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { useAppSelector } from "@/common/store/hooks"
import { selectUploaderState } from "../features/documents/documents.selectors"
import { StudioRoutes } from "./helpers"

export function SidebarFooterChildren({ project }: { project: Project }) {
  const { t } = useTranslation()
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex-col items-start mb-3">
        <span className="font-bold text-sm">{project.name}</span>
        <span className="uppercase">{t("project:settings")}</span>
      </SidebarGroupLabel>

      <SidebarGroupContent>
        <SidebarMenu>
          <NavEvaluation organizationId={project.organizationId} projectId={project.id} />
          <RestrictedFeature feature="project-analytics">
            <NavAnalytics organizationId={project.organizationId} projectId={project.id} />
          </RestrictedFeature>
          <NavSources organizationId={project.organizationId} projectId={project.id} />
          <NavProjectMemberships organizationId={project.organizationId} projectId={project.id} />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function NavReviewCampaigns({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation()
  const { isRoute } = useIsRoute()
  const isActive =
    isRoute(StudioRoutes.reviewCampaigns.path) || isRoute(StudioRoutes.reviewCampaignReport.path)
  const path = StudioRoutes.reviewCampaigns.build({ organizationId, projectId })
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton isActive={isActive} asChild>
        <Link to={path}>
          <MegaphoneIcon />
          <span>{t("reviewCampaigns:title")}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function NavProjectMemberships({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation()
  const { isRoute } = useIsRoute()
  const isActive = isRoute(StudioRoutes.projectMemberships.path)
  const path = StudioRoutes.projectMemberships.build({ organizationId, projectId })
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} asChild>
        <Link to={path}>
          <UsersIcon />
          <span className={cn(isActive && "font-semibold capitalize-first")}>
            {t("projectMembership:members")}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavAnalytics({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation("analytics")
  const { isRoute } = useIsRoute()
  const isActive = isRoute(StudioRoutes.projectAnalytics.path)
  const path = StudioRoutes.projectAnalytics.build({ organizationId, projectId })
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} asChild>
        <Link to={path}>
          <BarChart3Icon className="size-4" />
          <span className={cn(isActive && "font-semibold capitalize-first")}>{t("analytics")}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavSources({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const { t } = useTranslation()
  return (
    <Collapsible asChild className="group/sources">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <DatabaseZapIcon />
            <span>{t("document:sources")}</span>
            <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/sources:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <NavDocumentsList organizationId={organizationId} projectId={projectId} />
            <RestrictedFeature feature="web-sources">
              <NavWebSources organizationId={organizationId} projectId={projectId} />
            </RestrictedFeature>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function NavDocumentsList({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation()
  const { isRoute } = useIsRoute()
  const isActive = isRoute(StudioRoutes.documents.path)
  const path = StudioRoutes.documents.build({ organizationId, projectId })
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton isActive={isActive} asChild>
        <Link to={path}>
          <FileIcon />
          <span className="flex-1">{t("document:documents")}</span>
          <UploaderState />
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function NavWebSources({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation()
  const { isRoute } = useIsRoute()
  const isActive = isRoute(StudioRoutes.webSources.path)
  const path = StudioRoutes.webSources.build({ organizationId, projectId })
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton isActive={isActive} asChild>
        <Link to={path}>
          <GlobeIcon />
          <span>{t("document:filter.webSources")}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function UploaderState() {
  const uploaderState = useAppSelector(selectUploaderState)
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm">
      {uploaderState.status === "uploading" && (
        <>
          <Loader2Icon className="animate-spin size-4" />
          <span className="text-xs text-muted-foreground">
            {uploaderState.processed}/{uploaderState.total}
          </span>
        </>
      )}

      {uploaderState.errors && uploaderState.errors.length > 0 && (
        <CloudAlertIcon className="text-destructive size-5 animate-pulse" />
      )}
    </div>
  )
}

/**
 * Evaluation is a foldable category. The trigger toggles open/close instead of
 * navigating — children (currently only Review campaigns) are the destinations.
 * Once more evaluation surfaces are linked into Studio, they'll be added here as
 * additional `SidebarMenuSub*` entries.
 */
export function NavEvaluation({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation()
  return (
    <Collapsible asChild className="group/evaluation">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ListChecksIcon />
            <span>{t("evaluation:evaluations")}</span>
            <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/evaluation:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <NavReviewCampaigns organizationId={organizationId} projectId={projectId} />
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
