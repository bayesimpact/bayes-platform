import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { projectAgentSessionCategoryFactory } from "@/common/features/projects/projects.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  conversationReviewFactory,
  conversationReviewMessageFactory,
  conversationReviewSessionRowFactory,
  paginatedConversationReviewSessionsFactory,
} from "@/studio/features/conversation-review/conversation-review.factory"
import type {
  ConversationReview,
  ConversationReviewSessionRow,
  ConversationReviewTab,
} from "@/studio/features/conversation-review/conversation-review.models"
import type { IConversationReviewSpi } from "@/studio/features/conversation-review/conversation-review.spi"
import { REVIEW_SESSIONS_PAGE_SIZE } from "@/studio/features/conversation-review/conversation-review.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type ReviewSessionsCategory = "none" | "product" | "pricing" | "support" | "uncategorized"

type StoryArgs = StudioStoryArgs & {
  canReviewConversations?: boolean
  withReview?: boolean
  reviewKind?: ConversationReview["kind"]
  reviewTab?: ConversationReviewTab
  withCategories?: boolean
  withReviewSessions?: boolean
  reviewSessionsCategory?: ReviewSessionsCategory
}

/** The story's category names: neutral examples, in the order the select lists them. */
const STORY_CATEGORY_NAMES = ["Product", "Pricing", "Support"]

function buildSessionRows(categoryIds: (string | undefined)[]): ConversationReviewSessionRow[] {
  const [productId, , supportId] = categoryIds
  const rows: ConversationReviewSessionRow[] = []
  // The "Product" category spans two pages on purpose: the list story paginates it.
  if (productId) {
    for (let rowNumber = 0; rowNumber < 25; rowNumber += 1) {
      rows.push(
        conversationReviewSessionRowFactory.build({
          categoryId: productId,
          categoryName: "Product",
        }),
      )
    }
  }
  // The "Pricing" category stays empty on purpose: the empty-list story lists it.
  if (supportId) {
    for (let rowNumber = 0; rowNumber < 3; rowNumber += 1) {
      rows.push(
        conversationReviewSessionRowFactory.build({
          categoryId: supportId,
          categoryName: "Support",
        }),
      )
    }
  }
  for (let rowNumber = 0; rowNumber < 4; rowNumber += 1) {
    rows.push(
      conversationReviewSessionRowFactory.build({
        categoryId: null,
        categoryName: "uncategorized",
      }),
    )
  }
  return rows
}

/**
 * The conversation a listed row opens: the same id, kind and date as the row, so clicking
 * through the list swaps the transcript the way the API would.
 */
function reviewOfRow(row: ConversationReviewSessionRow): ConversationReview {
  return conversationReviewFactory.build({
    sessionId: row.sessionId,
    ...(row.kind === "public"
      ? {
          kind: "public",
          channel: row.channel ?? "embed",
          externalVisitorId: "visitor-42",
        }
      : { kind: "conversation", type: row.conversationType ?? "live" }),
    isSubSession: row.isSubSession,
    title: "Question about pricing",
    createdAt: row.createdAt,
    messages: [
      conversationReviewMessageFactory.build({ role: "user" }),
      conversationReviewMessageFactory.build({
        role: "assistant",
        status: "completed",
        toolNames: ["lookup_knowledge_base"],
      }),
      conversationReviewMessageFactory.build({ role: "user" }),
    ],
  })
}

function buildMockConversationReviewService(input: {
  review: ConversationReview
  sessionRows: ConversationReviewSessionRow[]
}): IConversationReviewSpi {
  const reviewBySessionId = new Map(
    input.sessionRows.map((row) => [row.sessionId, reviewOfRow(row)]),
  )
  return {
    async getOne({ agentSessionId }) {
      const review = reviewBySessionId.get(agentSessionId)
      if (review) return review
      // An id nobody listed opens the story's seeded conversation, like a pasted session id.
      return input.review
    },
    async listSessionsByCategory({ categoryId, page, limit }) {
      const rows =
        categoryId === null
          ? input.sessionRows.filter((row) => row.categoryId === null)
          : input.sessionRows.filter((row) => row.categoryId === categoryId)
      const start = (page - 1) * limit
      return {
        sessions: rows.slice(start, start + limit),
        total: rows.length,
        page,
        limit,
      }
    },
  }
}

const meta = {
  title: "routes/studio/project/agent/conversation-review",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    canReviewConversations: { control: "boolean" },
    withReview: { control: "boolean" },
    reviewKind: { control: "select", options: ["conversation", "public", "extraction"] },
    reviewTab: { control: "select", options: ["session-id", "by-category"] },
    withCategories: { control: "boolean" },
    withReviewSessions: { control: "boolean" },
    reviewSessionsCategory: {
      control: "select",
      options: ["none", "product", "pricing", "support", "uncategorized"],
    },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    canReviewConversations: true,
    withReview: false,
    reviewKind: "conversation",
    reviewTab: "session-id",
    withCategories: false,
    withReviewSessions: false,
    reviewSessionsCategory: "none",
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentConversationReview.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(
      ({
        canReviewConversations,
        withReview,
        withReviewSessions,
        reviewKind,
        reviewTab,
        withCategories,
        reviewSessionsCategory,
        ...args
      }) => {
        const { baseSeeds, user, project, agents } = buildStudioData(args)
        const [firstAgent, ...restAgents] = agents
        const currentAgent = agentFactory.transient({ project }).build({
          ...firstAgent,
          type: reviewKind === "extraction" ? "extraction" : "conversation",
        })
        const currentAgentSettings = agentSettingsFactory
          .transient({ agent: currentAgent })
          .build({ revision: currentAgent.currentRevision?.number ?? 1 })

        const categories = withCategories
          ? STORY_CATEGORY_NAMES.map((categoryName) =>
              projectAgentSessionCategoryFactory.build({ name: categoryName }),
            )
          : []

        const sessionRows = buildSessionRows(categories.map((category) => category.id))
        const listedCategory =
          reviewSessionsCategory === "none" || reviewSessionsCategory === "uncategorized"
            ? reviewSessionsCategory === "none"
              ? undefined
              : null
            : (
                categories.find(
                  (category) => category.name.toLowerCase() === reviewSessionsCategory,
                ) ?? { id: null, name: "Unknown" }
              ).id
        const listedRows =
          listedCategory === undefined
            ? []
            : sessionRows.filter((row) => row.categoryId === listedCategory)
        const selectedRow = listedRows[0]

        const review =
          reviewKind === "extraction"
            ? conversationReviewFactory.build({
                agentId: currentAgent.id,
                kind: "extraction",
                extraction: {
                  status: "success",
                  documentTitle: "report.pdf",
                  result: { title: "Quarterly report", summary: "Sales went up." },
                },
              })
            : conversationReviewFactory.build({
                agentId: currentAgent.id,
                ...(selectedRow ? { sessionId: selectedRow.sessionId } : {}),
                ...(selectedRow ? { createdAt: selectedRow.createdAt } : {}),
                ...(selectedRow?.kind === "conversation"
                  ? { type: selectedRow.conversationType ?? "live" }
                  : {}),
                title: "Question about pricing",
                ...(reviewKind === "public" || selectedRow?.kind === "public"
                  ? {
                      kind: "public",
                      channel: selectedRow?.channel ?? "embed",
                      externalVisitorId: "visitor-42",
                    }
                  : {}),
                messages: [
                  conversationReviewMessageFactory.build({ role: "user" }),
                  conversationReviewMessageFactory.build({
                    role: "assistant",
                    status: "completed",
                    toolNames: ["lookup_knowledge_base"],
                  }),
                  conversationReviewMessageFactory.build({ role: "user" }),
                  conversationReviewMessageFactory.build({ role: "assistant", status: "error" }),
                ],
              })

        const seededPage = paginatedConversationReviewSessionsFactory.build({
          sessions: listedRows.slice(0, REVIEW_SESSIONS_PAGE_SIZE),
          total: listedRows.length,
          page: 1,
          limit: REVIEW_SESSIONS_PAGE_SIZE,
        })

        return {
          state: mergeSeeds(
            baseSeeds,
            seed.me({
              ...user,
              conversationReviewAgentIds: canReviewConversations ? [currentAgent.id] : [],
            }),
            seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
            seed.conversationAgentSessions({ [currentAgent.id]: [] }),
            seed.extractionAgentSessions({ [currentAgent.id]: { csvSessions: [], others: [] } }),
            seed.studio.agentHistory({
              agentId: currentAgent.id,
              versions: [currentAgentSettings],
            }),
            categories.length > 0
              ? seed.projects([{ ...project, agentSessionCategories: categories }], {
                  currentId: project.id,
                })
              : {},
            reviewTab === "by-category" ? seed.studio.conversationReviewTab("by-category") : {},
            withReview || (withReviewSessions && selectedRow !== undefined)
              ? seed.studio.conversationReview(review)
              : {},
            withReviewSessions && listedCategory !== undefined
              ? seed.studio.conversationReviewSessions(seededPage, {
                  categoryId: listedCategory,
                  ...(selectedRow ? { selectedSessionId: selectedRow.sessionId } : {}),
                })
              : {},
          ),
          services: {
            conversationReview: buildMockConversationReviewService({
              review,
              sessionRows,
            }),
          },
        }
      },
    ),
  ],
}

export const WithConversation: Story = {
  args: { withReview: true },
  decorators: Default.decorators,
}

export const WithPublicSession: Story = {
  args: { withReview: true, reviewKind: "public" },
  decorators: Default.decorators,
}

export const WithExtractionSession: Story = {
  args: { withReview: true, reviewKind: "extraction" },
  decorators: Default.decorators,
}

export const WithoutPermission: Story = {
  args: { canReviewConversations: false },
  decorators: Default.decorators,
}

export const ByCategoryTab: Story = {
  args: { reviewTab: "by-category", withCategories: true },
  decorators: Default.decorators,
}

export const ByCategoryTabNoCategories: Story = {
  args: { reviewTab: "by-category", withCategories: false },
  decorators: Default.decorators,
}

export const ByCategoryList: Story = {
  args: {
    reviewTab: "by-category",
    withCategories: true,
    withReviewSessions: true,
    reviewSessionsCategory: "product",
  },
  decorators: Default.decorators,
}

export const ByCategoryListEmpty: Story = {
  args: {
    reviewTab: "by-category",
    withCategories: true,
    withReviewSessions: true,
    reviewSessionsCategory: "pricing",
  },
  decorators: Default.decorators,
}

export const ByCategoryListUncategorized: Story = {
  args: {
    reviewTab: "by-category",
    withReviewSessions: true,
    reviewSessionsCategory: "uncategorized",
  },
  decorators: Default.decorators,
}
