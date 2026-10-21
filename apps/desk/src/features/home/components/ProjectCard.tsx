import { FolderIcon } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { DeskProject } from "../desk-projects"

export type ProjectCardProps = {
  project: DeskProject
}

/** A project the person can open in the Desk. The project screen and its link come next. */
export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Card size="sm">
      <CardHeader className="flex items-center gap-2">
        <FolderIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <CardTitle className="truncate">{project.name}</CardTitle>
      </CardHeader>
    </Card>
  )
}
