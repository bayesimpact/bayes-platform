import { Button } from "@caseai-connect/ui/shad/button"
import { PlusIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { StudioRoutes } from "@/studio/routes/helpers"
import type { ResourceLibrary } from "../resource-libraries.models"
import { ResourceLibraryItem } from "./ResourceLibraryItem"

export function ResourceLibrariesManager({
  resourceLibraries,
}: {
  resourceLibraries: ResourceLibrary[]
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const newPath = StudioRoutes.resourceLibraryNew.build({ organizationId, projectId })

  const cols = resourceLibraries.length === 0 ? 0 : 3

  const handleBack = () => {
    navigate(StudioRoutes.project.build({ organizationId, projectId }))
  }

  return (
    <Grid cols={cols}>
      <GridHeader
        onBack={handleBack}
        title={t("resourceLibrary:title")}
        description={t("resourceLibrary:description")}
        action={
          <Button size="sm" onClick={() => navigate(newPath)}>
            <PlusIcon className="size-4" /> {t("resourceLibrary:actions.newLibrary")}
          </Button>
        }
      />
      <GridContent>
        {resourceLibraries.length === 0 ? (
          <GridCard span="full">
            <GridCard.Body>
              <GridCard.Description>{t("resourceLibrary:empty")}</GridCard.Description>
            </GridCard.Body>
          </GridCard>
        ) : (
          resourceLibraries.map((resourceLibrary) => (
            <ResourceLibraryItem key={resourceLibrary.id} resourceLibrary={resourceLibrary} />
          ))
        )}
      </GridContent>
    </Grid>
  )
}
