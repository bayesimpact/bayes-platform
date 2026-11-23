import { useLingui } from "@lingui/react"
import { composeStories, composeStory, setProjectAnnotations } from "@storybook/react-vite"
import { useQueryClient } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import previewAnnotations from "../../.storybook/preview"
import * as conversationStories from "./Conversation.stories"
import * as generalStories from "./Desk.stories"
import * as extractionStories from "./Extraction.stories"

setProjectAnnotations(previewAnnotations)

/** A component that needs what Storybook gives a story of one component: a locale and a cache. */
function LocaleAndCache() {
  const { i18n } = useLingui()
  const isRetrying = useQueryClient().getDefaultOptions().queries?.retry !== false
  return <p>{`Locale ${i18n.locale}, ${isRetrying ? "retrying" : "not retrying"}`}</p>
}

const {
  AgentCommandCenterOpen,
  AgentTheyOnlyRead,
  HistoryFailsToLoad,
  PageNotFound,
  ProjectsFailToLoad,
  Loading,
  NewReleaseOut,
  PageFailsAfterNewRelease,
  SidebarClosed,
  ...generalPages
} = composeStories(generalStories)
const { ReplyFails, PassageSelected, ...conversationPages } = composeStories(conversationStories)
const { DocumentDetails, CsvRunStopConfirmation, ...extractionPages } =
  composeStories(extractionStories)
/** The stories of a page, from the three folders of Storybook. */
const pageStories = {
  ...generalPages,
  ...conversationPages,
  ...extractionPages,
}

/** Each story of a page, and what it shows once that page loaded: every story is listed. */
const PAGES = {
  Home: {
    Story: pageStories.Home,
    loaded: () => screen.findByRole("heading", { name: "How can I help you today?" }),
  },
  Conversation: {
    Story: pageStories.Conversation,
    loaded: () => screen.findByText(/Here is a short comparison/),
  },
  QuotedMessage: {
    Story: pageStories.QuotedMessage,
    loaded: () => screen.findByText("two plans", { selector: "code" }),
  },
  LongConversation: {
    Story: pageStories.LongConversation,
    loaded: () => screen.findByRole("heading", { name: "What the billing team should check" }),
  },
  OneFollowUpQuestion: {
    Story: pageStories.OneFollowUpQuestion,
    loaded: () => screen.findByRole("button", { name: "What does renew mean?" }),
  },
  MostFollowUpQuestions: {
    Story: pageStories.MostFollowUpQuestions,
    loaded: () => screen.findByRole("button", { name: /Do I get a refund if I cancel/ }),
  },
  FollowUpQuestionAnswered: {
    Story: pageStories.FollowUpQuestionAnswered,
    loaded: () => screen.findByText("The Pro plan renews on the same day each month."),
  },
  FirstConversation: {
    Story: pageStories.FirstConversation,
    loaded: () => screen.findByText("No conversations yet"),
  },
  NewConversationWithGreeting: {
    Story: pageStories.NewConversationWithGreeting,
    loaded: () => screen.findByRole("heading", { name: "New conversation with Helpful Assistant" }),
  },
  SeveralAgents: {
    Story: pageStories.SeveralAgents,
    loaded: () => screen.findByRole("heading", { name: "What should Document Reader read?" }),
  },
  SeveralProjects: {
    Story: pageStories.SeveralProjects,
    loaded: () => screen.findByRole("button", { name: /Switch agent/ }),
  },
  NoAgent: {
    Story: pageStories.NoAgent,
    loaded: () => screen.findByText("You don't have access to an agent yet"),
  },
  TermsToAccept: {
    Story: pageStories.TermsToAccept,
    loaded: () => screen.findByRole("heading", { name: "Before you start" }),
  },
  NewExtraction: {
    Story: pageStories.NewExtraction,
    loaded: () => screen.findByRole("heading", { name: "What should Document Reader read?" }),
  },
  ExtractionPending: {
    Story: pageStories.ExtractionPending,
    loaded: () => screen.findByText("The agent is reading the document…"),
  },
  ExtractionResult: {
    Story: pageStories.ExtractionResult,
    loaded: () => screen.findByRole("heading", { name: "quarterly-report.pdf" }),
  },
  ExtractionFailure: {
    Story: pageStories.ExtractionFailure,
    loaded: () => screen.findByText(/The document has more pages than the agent can read at once/),
  },
  CsvSetup: {
    Story: pageStories.CsvSetup,
    loaded: () => screen.findByRole("heading", { name: "articles.csv" }),
  },
  CsvSetupOfHeaderOnlyFile: {
    Story: pageStories.CsvSetupOfHeaderOnlyFile,
    loaded: async () => {
      await screen.findByRole("heading", { name: "header-only.csv" })
      const [firstColumn] = screen.getAllByText("No values in the first rows")
      return firstColumn
    },
  },
  CsvSetupOfFileWithoutColumns: {
    Story: pageStories.CsvSetupOfFileWithoutColumns,
    loaded: () => screen.findByText("This file has no columns"),
  },
  CsvRun: {
    Story: pageStories.CsvRun,
    loaded: () => screen.findByText("24 of 24 rows"),
  },
} satisfies Record<keyof typeof pageStories, unknown>

/** The pages the Desk shows when something went wrong. */
const ERROR_PAGES = [
  "This page could not load",
  "Page not found",
  "A new version of the Desk is available",
]

const expectNoErrorPage = () => {
  for (const title of ERROR_PAGES) expect(screen.queryByText(title)).not.toBeInTheDocument()
}

describe("the stories of the Desk", () => {
  it.each(Object.entries(PAGES))("%s opens its page", async (_name, { Story, loaded }) => {
    await Story.load()
    render(<Story />)

    expect(await loaded()).toBeInTheDocument()
    expectNoErrorPage()
  })

  it("ReplyFails shows the server's reason once its message is sent, and answers the retry", async () => {
    await ReplyFails.load()
    const { container } = render(<ReplyFails />)
    await ReplyFails.play?.({ canvasElement: container })

    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("The model is overloaded")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText(/Here is what I found about "Hello"/)).toBeInTheDocument()
  })

  it("PassageSelected offers to copy or annotate the passage it selects", async () => {
    await PassageSelected.load()
    const { container } = render(<PassageSelected />)
    await PassageSelected.play?.({ canvasElement: container })

    expect(await screen.findByRole("button", { name: "Copy" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Annotate" })).toBeInTheDocument()
  })

  it("DocumentDetails opens the details of a document beside the page", async () => {
    await DocumentDetails.load()
    const { container } = render(<DocumentDetails />)
    await DocumentDetails.play?.({ canvasElement: container })

    const panel = await screen.findByRole("complementary", { name: "quarterly-report.pdf" })
    expect(within(panel).getByRole("heading", { name: "Quarterly report" })).toBeInTheDocument()
  })

  it("CsvRunStopConfirmation asks before it stops a run that still goes on", async () => {
    await CsvRunStopConfirmation.load()
    const { container } = render(<CsvRunStopConfirmation />)
    await CsvRunStopConfirmation.play?.({ canvasElement: container })

    const dialog = await screen.findByRole("alertdialog", { name: "Stop this extraction?" })
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Stop" })).toBeInTheDocument()
    expect(screen.getByText("9 of 24 rows")).toBeInTheDocument()
  })

  it("AgentTheyOnlyRead opens the switcher without the agent the person only reads", async () => {
    await AgentTheyOnlyRead.load()
    const { container } = render(<AgentTheyOnlyRead />)
    await AgentTheyOnlyRead.play?.({ canvasElement: container })

    const list = await screen.findByRole("listbox")
    expect(within(list).getAllByRole("option")).toEqual([
      within(list).getByRole("option", { name: "Helpful Assistant" }),
      within(list).getByRole("option", { name: "Document Reader Current" }),
    ])
  })

  it("AgentCommandCenterOpen opens the command center on the agents of every project", async () => {
    await AgentCommandCenterOpen.load()
    const { container } = render(<AgentCommandCenterOpen />)
    await AgentCommandCenterOpen.play?.({ canvasElement: container })

    const dialog = await screen.findByRole("dialog", { name: "Switch agent" })
    expect(within(dialog).getByRole("combobox", { name: "Search an agent" })).toHaveFocus()
    expect(within(dialog).getAllByRole("group").length).toBeGreaterThan(1)
    expect(within(dialog).getByText("Current")).toBeInTheDocument()
  })

  it("SidebarClosed peeks at the sidebar while the pointer is on its button, and hides it after", async () => {
    await SidebarClosed.load()
    const { container } = render(<SidebarClosed />)
    expect(await screen.findByRole("link", { name: "Compare the plans" })).toBeInTheDocument()
    await SidebarClosed.play?.({ canvasElement: container })
    const toggle = await screen.findByRole("button", { name: "Show the sidebar" })
    // The sidebar stays in the page when hidden, out of view: what it shows is its peek.
    const sidebarOf = (name: string) =>
      screen.getByRole("link", { name }).closest("[data-slot=sidebar-container]")
    expect(sidebarOf("Compare the plans")).not.toHaveAttribute("data-peek")

    await userEvent.hover(toggle)
    expect(sidebarOf("Compare the plans")).toHaveAttribute("data-peek", "true")

    await userEvent.unhover(toggle)
    await waitFor(() => expect(sidebarOf("Compare the plans")).not.toHaveAttribute("data-peek"))
    expect(screen.getByRole("button", { name: "Show the sidebar" })).toBeInTheDocument()
  })

  it("SidebarClosed opens the sidebar for good on a click of its button, even while it peeks", async () => {
    await SidebarClosed.load()
    const { container } = render(<SidebarClosed />)
    expect(await screen.findByRole("link", { name: "Compare the plans" })).toBeInTheDocument()
    await SidebarClosed.play?.({ canvasElement: container })

    const toggle = await screen.findByRole("button", { name: "Show the sidebar" })
    await userEvent.hover(toggle)
    await userEvent.click(toggle)
    await userEvent.unhover(toggle)

    expect(await screen.findByRole("button", { name: "Hide the sidebar" })).toBeInTheDocument()
    expect(
      screen
        .getByRole("link", { name: "Compare the plans" })
        .closest("[data-slot=sidebar-container]"),
    ).not.toHaveAttribute("data-peek")
  })

  it("NewReleaseOut shows a banner whose button reloads the page", async () => {
    await NewReleaseOut.load()
    const { container } = render(<NewReleaseOut />)
    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
    await act(() => NewReleaseOut.play?.({ canvasElement: container }))

    const banner = screen.getByRole("status")
    expect(within(banner).getByText("A new version of the Desk is available")).toBeInTheDocument()
    expect(
      within(banner).getByText("Reloading the page clears what you have not sent or saved."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument()
  })

  it("PageFailsAfterNewRelease offers a reload, not a retry", async () => {
    await PageFailsAfterNewRelease.load()
    const { container } = render(<PageFailsAfterNewRelease />)
    expect(await screen.findByText("This page could not load")).toBeInTheDocument()
    await act(() => PageFailsAfterNewRelease.play?.({ canvasElement: container }))

    expect(screen.getByText("A new version of the Desk is available")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("HistoryFailsToLoad keeps the page, and loads the history on its retry", async () => {
    await HistoryFailsToLoad.load()
    render(<HistoryFailsToLoad />)

    expect(await screen.findByText("The history could not load.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "How can I help you today?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("link", { name: "Compare the plans" })).toBeInTheDocument()
  })

  it("PageNotFound says so", async () => {
    await PageNotFound.load()
    render(<PageNotFound />)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })

  it("ProjectsFailToLoad shows its error at once, with a retry", async () => {
    await ProjectsFailToLoad.load()
    render(<ProjectsFailToLoad />)

    expect(await screen.findByText("This page could not load")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("Loading shows the frame of the Desk, and no page yet", async () => {
    await Loading.load()
    render(<Loading />)

    expect(await screen.findByRole("main")).toBeInTheDocument()
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
    expectNoErrorPage()
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
