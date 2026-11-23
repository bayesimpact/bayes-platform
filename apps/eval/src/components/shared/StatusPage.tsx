import type { ReactNode } from "react"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export type StatusPageProps = {
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  /** The way out: a retry, a reload, a link home. */
  action?: ReactNode
}

/** A full-page state with no data to show: an error, a page that does not exist. */
export function StatusPage({ icon, title, description, action }: StatusPageProps) {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
