import { Badge } from "@caseai-connect/ui/shad/badge"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { ExternalLinkIcon, XIcon } from "lucide-react"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { ResourceLibraryPicker } from "@/studio/features/resource-libraries/components/ResourceLibraryPicker"
import {
  getResourceLibraryTitleById,
  useResourceLibraries,
} from "@/studio/features/resource-libraries/resource-libraries.helpers"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { AgentFormValues } from "./agent-form.shared"

export function AgentResourceLibrariesTab() {
  const { t } = useTranslation()
  const { control } = useFormContext<AgentFormValues>()
  const { resourceLibraries } = useResourceLibraries()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const managerPath = StudioRoutes.resourceLibraries.build({ organizationId, projectId })

  return (
    <FieldGroup>
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel>{t("resourceLibrary:agentTab.label")}</FieldLabel>
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
        <FieldDescription>{t("resourceLibrary:agentTab.description")}</FieldDescription>
        <Controller
          control={control}
          name="resourceLibraryIds"
          render={({ field }) => {
            const selectedIds = field.value ?? []
            return (
              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.map((libraryId) => (
                  <Badge key={libraryId} variant="secondary" className="gap-1">
                    {getResourceLibraryTitleById(resourceLibraries, libraryId)}
                    <button
                      type="button"
                      onClick={() => field.onChange(selectedIds.filter((id) => id !== libraryId))}
                      className="opacity-60 hover:opacity-100"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
                <ResourceLibraryPicker
                  resourceLibraries={resourceLibraries}
                  attachedLibraryIds={selectedIds}
                  onAdd={(libraryId) => field.onChange([...selectedIds, libraryId])}
                />
              </div>
            )
          }}
        />
      </Field>
    </FieldGroup>
  )
}
