import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"

type ConversationParams = NonNullable<
  Parameters<typeof createOrganizationWithAgentSession>[0]["params"]
>

/**
 * A two-exchange billing conversation in a new organization: the last answer depends on the plan
 * the first message gave. Each message is a second after the one before, so the order is stable.
 */
export async function createConversationWithAnswers(
  repositories: AllRepositories,
  params: ConversationParams = {},
) {
  const data = await createOrganizationWithAgentSession({
    repositories,
    agentType: "conversation",
    params,
  })
  const { organization, project, agentSession, agentSettings } = data
  const startedAt = Date.now()
  const buildMessage = (
    fields: { role: "user" | "assistant"; content: string },
    offsetSeconds: number,
  ) =>
    agentMessageFactory
      .transient({ organization, project, session: agentSession, agentSettings })
      .build({ ...fields, createdAt: new Date(startedAt + offsetSeconds * 1000) })

  const firstQuestion = buildMessage(
    { role: "user", content: "I bought the annual Pro plan on March 3." },
    0,
  )
  const firstAnswer = buildMessage(
    { role: "assistant", content: "Thanks. What can I do for you about your Pro plan?" },
    1,
  )
  const lastQuestion = buildMessage(
    { role: "user", content: "Can I switch to the monthly plan and get the difference back?" },
    2,
  )
  const lastAnswer = buildMessage(
    { role: "assistant", content: "Yes, the unused part is refunded to your card." },
    3,
  )
  await repositories.agentMessageRepository.save([
    firstQuestion,
    firstAnswer,
    lastQuestion,
    lastAnswer,
  ])
  return { ...data, firstQuestion, firstAnswer, lastQuestion, lastAnswer }
}
