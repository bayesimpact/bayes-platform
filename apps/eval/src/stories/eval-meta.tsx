import type { Meta } from "@storybook/react-vite"
import { appBasePath } from "@/app/config"
import { evaluation } from "@/test/msw/story-api"
import { EvalStory } from "./EvalStory"

/**
 * What every story of the app shares, whichever folder of Storybook it sits in: the whole app on
 * the mocked API, one story per state of its world. Each opens a page, and the person goes
 * anywhere from there, as in the app itself.
 */
export const evalMeta = {
  // Every story is the whole app, with providers of its own: the main world by default.
  parameters: evaluation(),
  // Keyed by story: the next story starts an app of its own, on its own world, rather than keep
  // the router and the cache of the previous one.
  render: (_args, { id, loaded }) => (
    <EvalStory key={id} url={typeof loaded.evalUrl === "string" ? loaded.evalUrl : appBasePath} />
  ),
} satisfies Meta
