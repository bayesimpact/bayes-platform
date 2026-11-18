import type { AgentParamsDto, AgentTypeDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { BotIcon, FlaskConicalIcon, MegaphoneIcon } from "lucide-react"
import type { ReactNode } from "react"
import { NavCard } from "@/components/shared/NavCard"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusPage } from "@/components/shared/StatusPage"
import type { EvaluationAgent } from "@/features/agents"
import { AGENT_SECTION_ROUTES, type AgentSection } from "./agent-sections"

export type AgentHubPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  sections: AgentSection[]
}

/** What an evaluation runs the agent on, which depends on what the agent does. */
const EVALUATION_DESCRIPTIONS = {
  conversation: msg`Run this agent on datasets of conversations, and read how it answered.`,
  extraction: msg`Run this agent on datasets of documents, and read what it extracted.`,
} satisfies Record<AgentTypeDto, MessageDescriptor>

/**
 * The first page of an agent that opens several sections for the person: one card per section,
 * each the door to a feature. An agent that opens none says why.
 */
export function AgentHubPage({ agent, agentParams, sections }: AgentHubPageProps) {
  const { i18n } = useLingui()
  if (sections.length === 0) {
    return (
      <StatusPage
        icon={<BotIcon aria-hidden />}
        title={<Trans>Nothing to open for this agent</Trans>}
        description={
          <Trans>
            Review campaigns run on conversation agents. To evaluate this agent, ask an owner of its
            project for the evaluator role.
          </Trans>
        }
      />
    )
  }
  const cards = {
    evaluations: {
      icon: <FlaskConicalIcon aria-hidden />,
      title: <Trans>Evaluations</Trans>,
      description: i18n._(EVALUATION_DESCRIPTIONS[agent.type]),
    },
    campaigns: {
      icon: <MegaphoneIcon aria-hidden />,
      title: <Trans>Campaigns</Trans>,
      description: (
        <Trans>Invite people to try this agent, and others to review their conversations.</Trans>
      ),
    },
  } satisfies Record<AgentSection, { icon: ReactNode; title: ReactNode; description: ReactNode }>
  return (
    <PageContainer>
      <PageHeader
        title={agent.name}
        description={<Trans>What you can do with this agent.</Trans>}
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const { icon, title, description } = cards[section]
          return (
            <li key={section}>
              <NavCard
                render={<Link to={AGENT_SECTION_ROUTES[section]} params={agentParams} />}
                icon={icon}
                title={title}
                description={description}
              />
            </li>
          )
        })}
      </ul>
    </PageContainer>
  )
}
