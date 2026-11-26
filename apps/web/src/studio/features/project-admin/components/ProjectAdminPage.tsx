import { FieldGroup, FieldSet } from "@bayes-platform/ui/shad/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@bayes-platform/ui/shad/tabs"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import {
  selectCurrentProjectData,
  selectRetentionSweepRunsData,
} from "@/common/features/projects/projects.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { ProjectAgentSessionCategoriesForm } from "./ProjectAgentSessionCategoriesForm"
import { ProjectGeneralForm } from "./ProjectGeneralForm"
import { ProjectRetentionPolicyForm } from "./ProjectRetentionPolicyForm"
import { RetentionSweepRunLog } from "./RetentionSweepRunLog"

export function ProjectAdminPage() {
  const { t } = useTranslation()
  const project = useValue(selectCurrentProjectData)
  const retentionSweepRuns = useAppSelector(selectRetentionSweepRunsData)
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
                <TabsTrigger value="retention">{t("projectAdmin:tabs.retention")}</TabsTrigger>
                <TabsTrigger value="categories">
                  {t("projectAdmin:tabs.agentSessionCategories")}
                </TabsTrigger>
              </TabsList>

              <div className="p-2">
                <TabsContent value="general" forceMount className="data-[state=inactive]:hidden">
                  <ProjectGeneralForm project={project} />
                </TabsContent>

                <TabsContent value="retention" forceMount className="data-[state=inactive]:hidden">
                  <div className="flex flex-col gap-6">
                    <ProjectRetentionPolicyForm project={project} />
                    <AsyncRoute data={[retentionSweepRuns]}>
                      <RetentionSweepRunLogSection />
                    </AsyncRoute>
                  </div>
                </TabsContent>

                <TabsContent value="categories" forceMount className="data-[state=inactive]:hidden">
                  <ProjectAgentSessionCategoriesForm categories={project.agentSessionCategories} />
                </TabsContent>
              </div>
            </Tabs>
          </FieldSet>
        </FieldGroup>
      </div>
    </>
  )
}

function RetentionSweepRunLogSection() {
  const log = useValue(selectRetentionSweepRunsData)
  return <RetentionSweepRunLog log={log} />
}
