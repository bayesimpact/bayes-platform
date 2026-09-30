import { Input } from "@caseai-connect/ui/shad/input"
import { SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { MembersCreator } from "@/studio/features/project-memberships/components/MembersCreator"
import { ProjectMembershipItem } from "@/studio/features/project-memberships/components/ProjectMembershipItem"
import { selectProjectMemberships } from "@/studio/features/project-memberships/project-memberships.selectors"

export function ProjectMembershipList() {
  const outlet = useOutlet()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const project = useValue(selectCurrentProjectData)
  const memberships = useValue(selectProjectMemberships)

  const [searchQuery, setSearchQuery] = useState("")
  const projectRoute = useGetProjectRoute()
  const handleBack = () => navigate(projectRoute)

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

  if (outlet) return outlet
  return (
    <Grid cols={cols}>
      <GridHeader
        onBack={handleBack}
        title={t("projectMembership:list.title", { projectName: project.name })}
        description={t("projectMembership:list.description")}
        action={<Search value={searchQuery} onChange={setSearchQuery} />}
      />

      <GridContent>
        {filteredMemberships.map((membership) => (
          <ProjectMembershipItem
            organizationId={project.organizationId}
            key={membership.id}
            membership={membership}
          />
        ))}

        <GridCard className="bg-muted/35">
          <GridCard.Body>
            <GridCard.Title>{t("projectMembership:create.title")}</GridCard.Title>
            <GridCard.Description>{t("projectMembership:create.description")}</GridCard.Description>
            <MembersCreator projectId={project.id} />
          </GridCard.Body>
        </GridCard>
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
