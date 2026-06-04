import { Input } from "@caseai-connect/ui/shad/input"
import { SearchIcon } from "lucide-react"
import { createContext, type ReactNode, useContext, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Organization } from "@/common/features/organizations/organizations.models"

type SearchWorkspacesContextValue = {
  query: string
  setQuery: (value: string) => void
  organizations: Organization[]
  filteredOrganizations: Organization[]
  hasManyProjects: boolean
}

const SearchWorkspacesContext = createContext<SearchWorkspacesContextValue | null>(null)

function useSearchWorkspacesContext() {
  const context = useContext(SearchWorkspacesContext)
  if (!context) {
    throw new Error("SearchWorkspaces components must be rendered inside <SearchWorkspaces>")
  }
  return context
}

function SearchWorkspacesProvider({
  organizations,
  children,
}: {
  organizations: Organization[]
  children: ReactNode
}) {
  const [query, setQuery] = useState("")
  const value = useMemo<SearchWorkspacesContextValue>(() => {
    const filteredOrganizations = filterOrganizations(organizations, query)
    const hasManyProjects = organizations.some((org) => org.projects.length > 1)
    return { query, setQuery, organizations, filteredOrganizations, hasManyProjects }
  }, [organizations, query])
  return (
    <SearchWorkspacesContext.Provider value={value}>{children}</SearchWorkspacesContext.Provider>
  )
}

export function SearchWorkspaces({
  organizations,
  children,
}: {
  organizations: Organization[]
  children: ReactNode
}) {
  return (
    <SearchWorkspacesProvider organizations={organizations}>{children}</SearchWorkspacesProvider>
  )
}

export function SearchWorkspacesInput() {
  const { query, setQuery, hasManyProjects } = useSearchWorkspacesContext()
  const { t } = useTranslation()
  if (!hasManyProjects) return null
  return (
    <div className="relative w-64">
      <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("actions:search")}
        autoFocus
        className="pl-8"
      />
    </div>
  )
}

export function SearchWorkspacesResults({
  children,
}: {
  children: (organizations: Organization[]) => ReactNode
}) {
  const { filteredOrganizations } = useSearchWorkspacesContext()
  return <>{children(filteredOrganizations)}</>
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function filterOrganizations(organizations: Organization[], query: string): Organization[] {
  const needle = normalize(query)
  if (!needle) return organizations
  return organizations.flatMap((organization) => {
    const orgMatches = normalize(organization.name).includes(needle)
    if (orgMatches) return [organization]
    const matchingProjects = organization.projects.filter((project) =>
      normalize(project.name).includes(needle),
    )
    if (matchingProjects.length === 0) return []
    return [{ ...organization, projects: matchingProjects }]
  })
}
