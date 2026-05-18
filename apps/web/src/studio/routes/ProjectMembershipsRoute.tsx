import { Input } from "@caseai-connect/ui/shad/input"
import { SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import type { Project } from "@/common/features/projects/projects.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useAppSelector } from "@/common/store/hooks"
import { MembersCreator } from "@/studio/features/project-memberships/components/MembersCreator"
import { ProjectMembershipItem } from "@/studio/features/project-memberships/components/ProjectMembershipItem"
import type { ProjectMembership } from "@/studio/features/project-memberships/project-memberships.models"
import { selectProjectMemberships } from "@/studio/features/project-memberships/project-memberships.selectors"
import { AsyncRoute } from "../../common/routes/AsyncRoute"

export function ProjectMembershipsRoute() {
  const project = useAppSelector(selectCurrentProjectData)
  const memberships = useAppSelector(selectProjectMemberships)

  return (
    <AsyncRoute data={[memberships, project]}>
      {([membershipsValue, projectValue]) => (
        <WithData memberships={membershipsValue} project={projectValue} />
      )}
    </AsyncRoute>
  )
}

function WithData({
  memberships,
  project,
}: {
  memberships: ProjectMembership[]
  project: Project
}) {
  const outlet = useOutlet()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const getProjectRoute = useGetProjectRoute()
  const handleBack = () => navigate(getProjectRoute())

  const filteredMemberships = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return memberships
    return memberships.filter((membership) => {
      const userName = membership.userName?.toLowerCase() ?? ""
      const userEmail = membership.userEmail.toLowerCase()
      return userName.includes(query) || userEmail.includes(query)
    })
  }, [memberships, searchQuery])

  const cols = filteredMemberships.length === 0 ? 0 : 3
  const total = filteredMemberships.length

  if (outlet) return outlet
  return (
    <Grid cols={cols} total={total} extraItems={1}>
      <GridHeader
        onBack={handleBack}
        title={t("projectMembership:list.title", { projectName: project.name })}
        description={t("projectMembership:list.description")}
        action={<Search value={searchQuery} onChange={setSearchQuery} />}
      />

      <GridContent>
        {filteredMemberships.map((membership, index) => (
          <ProjectMembershipItem
            organizationId={project.organizationId}
            index={index}
            key={membership.id}
            membership={membership}
          />
        ))}

        <GridItem
          index={total}
          title={t("projectMembership:create.title")}
          description={t("projectMembership:create.description")}
          action={<MembersCreator />}
          className="bg-muted/35"
        />
      </GridContent>
    </Grid>
  )
}

function Search({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="relative max-w-sm">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        className="pl-8 min-w-60"
        placeholder={t("projectMembership:list.searchPlaceholder")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="search"
      />
    </div>
  )
}
