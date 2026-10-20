import type { MeProjectOutputDto } from "@caseai-connect/desk-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { ProjectList } from "./ProjectList"
import { ProjectListEmpty } from "./ProjectListEmpty"

export type HomePageProps = {
  projects: MeProjectOutputDto[]
}

/** The Desk's home: the projects where the person can open the Desk. */
export function HomePage({ projects }: HomePageProps) {
  const count = projects.length
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans>Your projects</Trans>
        </h1>
        {count > 0 ? (
          <p className="text-sm text-muted-foreground">
            <Plural value={count} one="# project" other="# projects" />
          </p>
        ) : null}
      </header>
      {count > 0 ? <ProjectList projects={projects} /> : <ProjectListEmpty />}
    </div>
  )
}
