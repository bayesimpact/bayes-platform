import type { DeskWorld } from "./factories/desk-world.factory"

/** The URL of a conversation of the first agent of a world, the latest one by default. */
export function conversationUrlOf(world: DeskWorld, position = 0): string {
  const [agent] = world.agents
  const conversation = world.conversations[agent?.id ?? ""]?.[position]
  return `/app/o/${world.organizations[0]?.id}/p/${agent?.projectId}/a/${agent?.id}/as/${conversation?.id}`
}
