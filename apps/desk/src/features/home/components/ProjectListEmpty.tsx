import { Trans } from "@lingui/react/macro"
import { FolderIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function ProjectListEmpty() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>
          <Trans>No project yet</Trans>
        </EmptyTitle>
        <EmptyDescription>
          <Trans>When someone adds you to a project, it appears here.</Trans>
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
