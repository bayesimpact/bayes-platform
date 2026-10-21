import type { ChatResource } from "../chat-messages"
import type { OpenedResource } from "../resource-media"
import { ResourceCard } from "./ResourceCard"

export type ResourceCardsProps = {
  resources: ChatResource[]
  onOpenResource?: (video: OpenedResource) => void
}

/** The resources of the agent's libraries a reply points to, as cards that open them. */
export function ResourceCards({ resources, onOpenResource }: ResourceCardsProps) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {resources.map((resource) => (
        <li key={resource.id}>
          <ResourceCard resource={resource} onOpenResource={onOpenResource} />
        </li>
      ))}
    </ul>
  )
}
