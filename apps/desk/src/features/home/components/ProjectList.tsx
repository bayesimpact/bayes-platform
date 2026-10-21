import type { DeskProject } from "../desk-projects"
import { ProjectCard } from "./ProjectCard"

export type ProjectListProps = {
  projects: DeskProject[]
}

type OrganizationProjects = {
  organization: DeskProject["organization"]
  projects: DeskProject[]
}

/** The projects grouped by organization, in the order the API sorts them. */
function groupByOrganization(projects: DeskProject[]): OrganizationProjects[] {
  const groups = new Map<string, OrganizationProjects>()
  for (const project of projects) {
    const group = groups.get(project.organization.id)
    if (group) group.projects.push(project)
    else
      groups.set(project.organization.id, {
        organization: project.organization,
        projects: [project],
      })
  }
  return [...groups.values()]
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="flex flex-col gap-8">
      {groupByOrganization(projects).map((group) => (
        <section
          key={group.organization.id}
          aria-labelledby={`organization-${group.organization.id}`}
        >
          <h2
            id={`organization-${group.organization.id}`}
            className="mb-3 text-sm font-medium text-muted-foreground"
          >
            {group.organization.name}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
