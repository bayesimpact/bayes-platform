import type { Meta } from "@storybook/react-vite"
import { desk } from "@/test/msw/story-api"
import { DeskStory } from "./DeskStory"

/**
 * What every story of the Desk shares, whichever folder of Storybook it sits in: the whole Desk
 * on the mocked API, one story per state of its world. Each opens a page, and the person goes
 * anywhere from there, as in the Desk itself.
 */
export const deskMeta = {
  // Every story is the whole Desk, with providers of its own: the main world by default.
  parameters: desk(),
  // Keyed by story: the next story starts a Desk of its own, on its own world, rather than keep
  // the router and the cache of the previous one.
  render: (_args, { id, loaded }) => (
    <DeskStory key={id} url={typeof loaded.deskUrl === "string" ? loaded.deskUrl : "/app/"} />
  ),
} satisfies Meta
