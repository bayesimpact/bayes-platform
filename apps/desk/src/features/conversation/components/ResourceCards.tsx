import type { ChatResource } from "../chat-messages"
import { ResourceCard } from "./ResourceCard"

export type ResourceCardsProps = {
  resources: ChatResource[]
}

/** The resources of the agent's libraries a reply points to, as cards that open them. */
export function ResourceCards({ resources }: ResourceCardsProps) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {resources.map((resource) => (
        <li key={resource.id}>
          <ResourceCard resource={resource} />
        </li>
      ))}
    </ul>
  )
}
