import { useLingui } from "@lingui/react"
import { composeStories, composeStory, setProjectAnnotations } from "@storybook/react-vite"
import { useQueryClient } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import previewAnnotations from "../../.storybook/preview"
import * as generalStories from "./Eval.stories"

setProjectAnnotations(previewAnnotations)

/** A component that needs what Storybook gives a story of one component: a locale and a cache. */
function LocaleAndCache() {
  const { i18n } = useLingui()
  const isRetrying = useQueryClient().getDefaultOptions().queries?.retry !== false
  return <p>{`Locale ${i18n.locale}, ${isRetrying ? "retrying" : "not retrying"}`}</p>
}

const { Home, NoEvaluationAccess, PageNotFound } = composeStories(generalStories)

describe("the stories of the app", () => {
  it("Home opens the home page", async () => {
    await Home.load()
    render(<Home />)

    expect(await screen.findByRole("heading", { name: "Hello world!" })).toBeInTheDocument()
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument()
  })

  it("NoEvaluationAccess says why the app is closed, and shows no page", async () => {
    await NoEvaluationAccess.load()
    render(<NoEvaluationAccess />)

    expect(await screen.findByText("You cannot evaluate agents yet")).toBeInTheDocument()
    expect(screen.queryByRole("main")).not.toBeInTheDocument()
  })

  it("PageNotFound says so", async () => {
    await PageNotFound.load()
    render(<PageNotFound />)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})

describe("a story of one component", () => {
  it("gets the language of the toolbar and a cache whose queries do not retry", async () => {
    const Story = composeStory({ render: () => <LocaleAndCache /> }, { title: "Component" })
    await Story.load()
    render(<Story />)

    expect(screen.getByText("Locale en, not retrying")).toBeInTheDocument()
  })
})
