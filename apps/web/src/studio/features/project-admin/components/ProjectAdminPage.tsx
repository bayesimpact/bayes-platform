import { FieldGroup, FieldSet } from "@caseai-connect/ui/shad/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { ProjectGeneralForm } from "./ProjectGeneralForm"
import { ProjectSessionCategoriesForm } from "./ProjectSessionCategoriesForm"

export function ProjectAdminPage() {
  const { t } = useTranslation()
  const project = useValue(selectCurrentProjectData)
  const navigate = useNavigate()
  const projectRoute = useGetProjectRoute()

  return (
    <>
      <GridHeader
        onBack={() => navigate(projectRoute)}
        title={t("projectAdmin:title")}
        description={t("projectAdmin:description")}
      />
      <div className="p-4 bg-white">
        <FieldGroup>
          <FieldSet>
            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">{t("projectAdmin:tabs.general")}</TabsTrigger>
                <TabsTrigger value="categories">
                  {t("projectAdmin:tabs.agentSessionCategories")}
                </TabsTrigger>
              </TabsList>

              <div className="p-2">
                <TabsContent value="general" forceMount className="data-[state=inactive]:hidden">
                  <ProjectGeneralForm project={project} />
                </TabsContent>

                <TabsContent value="categories" forceMount className="data-[state=inactive]:hidden">
                  <ProjectSessionCategoriesForm categories={project.agentSessionCategories} />
                </TabsContent>
              </div>
            </Tabs>
          </FieldSet>
        </FieldGroup>
      </div>
    </>
  )
}
