import { useLingui } from "@lingui/react"
import { composeStories, composeStory, setProjectAnnotations } from "@storybook/react-vite"
import { useQueryClient } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "storybook/test"
import { describe, expect, it } from "vitest"
import previewAnnotations from "../../.storybook/preview"
import * as campaignStories from "./Campaigns.stories"
import * as generalStories from "./Eval.stories"
import * as reviewerStories from "./Reviewer.stories"
import * as testerStories from "./Tester.stories"

setProjectAnnotations(previewAnnotations)

/** A component that needs what Storybook gives a story of one component: a locale and a cache. */
function LocaleAndCache() {
  const { i18n } = useLingui()
  const isRetrying = useQueryClient().getDefaultOptions().queries?.retry !== false
  return <p>{`Locale ${i18n.locale}, ${isRetrying ? "retrying" : "not retrying"}`}</p>
}

const {
  PageNotFound,
  ProjectsFailToLoad,
  Loading,
  SidebarPeek,
  NewReleaseOut,
  PageFailsAfterNewRelease,
  ...generalPages
} = composeStories(generalStories)
const { RemoveQuestion, LeaveWithUnsavedChanges, ChooseAgentVersion, ...campaignPages } =
  composeStories(campaignStories)
// The reviewer and the tester both have a story named after their campaign.
const { ClosedCampaign: ReviewerClosedCampaign, ...reviewerPages } = composeStories(reviewerStories)
const { Campaign: TesterCampaign, ...testerPages } = composeStories(testerStories)
/** The stories of a page, from every folder of Storybook. */
const pageStories = {
  ...generalPages,
  ...campaignPages,
  ...reviewerPages,
  ReviewerClosedCampaign,
  TesterCampaign,
  ...testerPages,
}

/** Each story of a page, and what it shows once that page loaded: every story is listed. */
const PAGES = {
  Home: {
    Story: pageStories.Home,
    loaded: () => screen.findByRole("heading", { name: "Helpful Assistant" }),
  },
  EveryAccess: {
    Story: pageStories.EveryAccess,
    loaded: () => screen.findByRole("button", { name: "Reviewer" }),
  },
  PendingInvitations: {
    Story: pageStories.PendingInvitations,
    loaded: () => screen.findByRole("button", { name: "2 pending invitations" }),
  },
  CampaignManagerOnly: {
    Story: pageStories.CampaignManagerOnly,
    loaded: () => screen.findByRole("heading", { name: "Campaigns" }),
  },
  SeveralProjects: {
    Story: pageStories.SeveralProjects,
    loaded: () => screen.findByRole("dialog", { name: "Switch agent" }),
  },
  AgentAmongSeveral: {
    Story: pageStories.AgentAmongSeveral,
    loaded: () => screen.findByRole("button", { name: /Switch agent/ }),
  },
  ManyAgents: {
    Story: pageStories.ManyAgents,
    loaded: () => screen.findByRole("dialog", { name: "Switch agent" }),
  },
  NoAgent: {
    Story: pageStories.NoAgent,
    loaded: () => screen.findByText("Your projects have no agent yet"),
  },
  NoEvaluationAccess: {
    Story: pageStories.NoEvaluationAccess,
    loaded: () => screen.findByText("You have no access to Evaluation yet"),
  },
  CampaignList: {
    Story: pageStories.CampaignList,
    loaded: () => screen.findByRole("heading", { name: "Campaigns" }),
  },
  NoCampaign: {
    Story: pageStories.NoCampaign,
    loaded: () => screen.findByText("No review campaign yet"),
  },
  NewCampaign: {
    Story: pageStories.NewCampaign,
    loaded: () => screen.findByRole("button", { name: "Choose a version" }),
  },
  NewCampaignWithNoSavedVersion: {
    Story: pageStories.NewCampaignWithNoSavedVersion,
    loaded: () => screen.findByText(/This agent has no saved version yet/),
  },
  DraftCampaign: {
    Story: pageStories.DraftCampaign,
    loaded: () => screen.findByRole("textbox", { name: "Name" }),
  },
  SetupSessionQuestions: {
    Story: pageStories.SetupSessionQuestions,
    loaded: () => screen.findByRole("heading", { name: "After each session" }),
  },
  SetupFinalQuestions: {
    Story: pageStories.SetupFinalQuestions,
    loaded: () => screen.findByRole("heading", { name: "Final survey" }),
  },
  SetupReviewerQuestions: {
    Story: pageStories.SetupReviewerQuestions,
    loaded: () => screen.findByRole("heading", { name: "Session review" }),
  },
  SetupActivate: {
    Story: pageStories.SetupActivate,
    loaded: () => screen.findByRole("button", { name: "Activate the campaign" }),
  },
  SetupInvite: {
    Story: pageStories.SetupInvite,
    loaded: () => screen.findByRole("heading", { name: "Invite participants" }),
  },
  CampaignPreview: {
    Story: pageStories.CampaignPreview,
    loaded: () => screen.findByRole("complementary", { name: "Preview" }),
  },
  ActiveCampaign: {
    Story: pageStories.ActiveCampaign,
    loaded: () => screen.findByRole("heading", { name: "Pending invitations" }),
  },
  ActiveCampaignOnPhone: {
    Story: pageStories.ActiveCampaignOnPhone,
    loaded: () => screen.findByRole("heading", { name: "Pending invitations" }),
  },
  LockedSetup: {
    Story: pageStories.LockedSetup,
    loaded: () => screen.findByRole("tab", { name: "Session review" }),
  },
  ClosedCampaignOnArchivedVersion: {
    Story: pageStories.ClosedCampaignOnArchivedVersion,
    loaded: () => screen.findByText("An archived version"),
  },
  ClosedCampaignSetup: {
    Story: pageStories.ClosedCampaignSetup,
    loaded: () => screen.findByText("Version 2"),
  },
  ClosedCampaign: {
    Story: pageStories.ClosedCampaign,
    loaded: () => screen.findByText("Final surveys"),
  },
  CampaignReport: {
    Story: pageStories.CampaignReport,
    loaded: () => screen.findByText("Mean reviewer rating"),
  },
  Sessions: {
    Story: pageStories.Sessions,
    loaded: () => screen.findByRole("heading", { name: "Sessions to review" }),
  },
  BlindSession: {
    Story: pageStories.BlindSession,
    loaded: () => screen.findByRole("heading", { name: "Session facts" }),
  },
  ReviewedSession: {
    Story: pageStories.ReviewedSession,
    loaded: () => screen.findByRole("heading", { name: "Other reviewers" }),
  },
  ReviewerClosedCampaign: {
    Story: pageStories.ReviewerClosedCampaign,
    loaded: () => screen.findByRole("heading", { name: "Your review" }),
  },
  Report: {
    Story: pageStories.Report,
    loaded: () => screen.findByText("Mean reviewer rating"),
  },
  TesterCampaign: {
    Story: pageStories.TesterCampaign,
    loaded: () => screen.findByRole("button", { name: "Start a session" }),
  },
  SeveralAgents: {
    Story: pageStories.SeveralAgents,
    loaded: () => screen.findByRole("button", { name: /^Switch agent/ }),
  },
  NoSession: {
    Story: pageStories.NoSession,
    loaded: () => screen.findByText(/You have not started a session yet/),
  },
  Session: {
    Story: pageStories.Session,
    loaded: () => screen.findByText(/For a team of five/),
  },
  RatedSession: {
    Story: pageStories.RatedSession,
    loaded: () => screen.findByText(/You can change plan at any time/),
  },
  FinalSurvey: {
    Story: pageStories.FinalSurvey,
    loaded: () => screen.findByRole("button", { name: "Submit survey" }),
  },
} satisfies Record<keyof typeof pageStories, unknown>

/** The pages the app shows when something went wrong. */
const ERROR_PAGES = [
  "This page could not load",
  "Page not found",
  "A new version of the app is available",
]

const expectNoErrorPage = () => {
  for (const title of ERROR_PAGES) expect(screen.queryByText(title)).not.toBeInTheDocument()
}

describe("the stories of the app", () => {
  it.each(Object.entries(PAGES))("%s opens its page", async (_name, { Story, loaded }) => {
    await Story.load()
    render(<Story />)

    expect(await loaded()).toBeInTheDocument()
    expectNoErrorPage()
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

  it("NewReleaseOut shows a banner whose button reloads the page", async () => {
    await NewReleaseOut.load()
    const { container } = render(<NewReleaseOut />)
    expect(await screen.findByRole("navigation", { name: /^Sections of/ })).toBeInTheDocument()
    await act(() => NewReleaseOut.play?.({ canvasElement: container }))

    const banner = screen.getByRole("status")
    expect(within(banner).getByText("A new version of Evaluation is available")).toBeInTheDocument()
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

    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("SidebarPeek shows the hidden sidebar while the pointer rests on its button", async () => {
    await SidebarPeek.load()
    const { container } = render(<SidebarPeek />)
    await act(() => SidebarPeek.play?.({ canvasElement: container }))

    const sidebar = () => container.querySelector('[data-slot="sidebar-container"]')
    await waitFor(() => expect(sidebar()).toHaveAttribute("data-peek"))
    expect(sidebar()?.closest('[data-slot="sidebar"]')).toHaveAttribute("data-state", "collapsed")

    // It hides a moment after the pointer leaves the button. The stories' own pointer leaves it,
    // so the next story does not start over that button.
    await userEvent.unhover(screen.getByRole("button", { name: "Show the sidebar" }))
    await waitFor(() => expect(sidebar()).not.toHaveAttribute("data-peek"))
  })

  it("RemoveQuestion asks before it removes a question with text", async () => {
    await RemoveQuestion.load()
    const { container } = render(<RemoveQuestion />)
    await act(() => RemoveQuestion.play?.({ canvasElement: container }))

    expect(
      await screen.findByRole("alertdialog", { name: "Remove question 1?" }),
    ).toBeInTheDocument()
  })

  it("ChooseAgentVersion opens the history of the agent's versions", async () => {
    await ChooseAgentVersion.load()
    const { container } = render(<ChooseAgentVersion />)
    await act(() => ChooseAgentVersion.play?.({ canvasElement: container }))

    expect(
      await screen.findByRole("dialog", { name: "Versions of Helpful Assistant" }),
    ).toBeInTheDocument()
  })

  it("LeaveWithUnsavedChanges asks before the changes are lost", async () => {
    await LeaveWithUnsavedChanges.load()
    const { container } = render(<LeaveWithUnsavedChanges />)
    await act(() => LeaveWithUnsavedChanges.play?.({ canvasElement: container }))

    expect(
      await screen.findByRole("alertdialog", { name: "Leave without saving?" }),
    ).toBeInTheDocument()
  })

  it("Loading shows the frame of the app, and no page yet", async () => {
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
