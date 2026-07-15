import {
  type UpdateAgentResourcesDto,
  updateAgentResourcesSchema,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLinkIcon, XIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { ResourceLibraryPicker } from "@/studio/features/resource-libraries/components/ResourceLibraryPicker"
import {
  getResourceLibraryTitleById,
  useResourceLibraries,
} from "@/studio/features/resource-libraries/resource-libraries.helpers"
import { StudioRoutes } from "@/studio/routes/helpers"
import { updateAgentResources } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, useReportDirty } from "./agent-tab-form.shared"

export function AgentResourceLibrariesTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { resourceLibraries } = useResourceLibraries()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const managerPath = StudioRoutes.resourceLibraries.build({ organizationId, projectId })

  const form = useForm<UpdateAgentResourcesDto>({
    resolver: zodResolver(updateAgentResourcesSchema),
    defaultValues: { resourceLibraryIds: agent.resourceLibraryIds },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  const handleSubmit = form.handleSubmit(async (values) => {
    await dispatch(updateAgentResources({ agentId: agent.id, fields: values })).unwrap()
    form.reset(values)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="resourceLibraryIds"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>{t("resourceLibrary:agentTab.label")}</FormLabel>
                <Link
                  to={managerPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t("resourceLibrary:manage")}
                  <ExternalLinkIcon className="size-3.5" />
                </Link>
              </div>
              <FormDescription>{t("resourceLibrary:agentTab.description")}</FormDescription>
              <FormControl>
                <div className="flex flex-wrap items-center gap-2">
                  {field.value.map((libraryId) => (
                    <Badge key={libraryId} variant="secondary" className="gap-1">
                      {getResourceLibraryTitleById(resourceLibraries, libraryId)}
                      <button
                        type="button"
                        onClick={() => field.onChange(field.value.filter((id) => id !== libraryId))}
                        className="opacity-60 hover:opacity-100"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <ResourceLibraryPicker
                    resourceLibraries={resourceLibraries}
                    attachedLibraryIds={field.value}
                    onAdd={(libraryId) => field.onChange([...field.value, libraryId])}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
          onCancel={() => form.reset()}
        />
      </form>
    </Form>
  )
}
