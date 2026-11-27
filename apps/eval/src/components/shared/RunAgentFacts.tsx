import { Button } from "@caseai-connect/app-ui/components/button"
import { ExternalLink } from "@caseai-connect/app-ui/compositions/ExternalLink"
import type {
  AgentParamsDto,
  AgentTypeDto,
  AgentVersionOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { type ReactNode, useState } from "react"
import { AGENT_TYPE_LABELS } from "@/lib/agent-type-labels"
import { studioAgentPathOf } from "@/lib/studio-path"
import { AgentTypeIcon } from "./AgentTypeIcon"
import { AgentVersionsSheet } from "./AgentVersionsSheet"
import { RunFact } from "./RunFact"

export type RunAgentFactsProps = {
  /** The agent the run asked: its name and its type. */
  agent: { name: string; type: AgentTypeDto }
  agentParams: AgentParamsDto
  /** The revision of the version the run asked. */
  revision: number
  /** The saved versions of the agent: an archived one is not among them. */
  versions: AgentVersionOutputDto[]
  /** Whether the person opens the Studio of the project, where the agent is set up. */
  canOpenStudio: boolean
  /** The facts of the version, which each type of agent has its own. */
  children: ReactNode
}

/**
 * What a run used about its agent, in its side panel, for an agent of any type: the agent and its
 * type, the version the run asked, which opens the history of its versions to compare it, the
 * facts of that version, then the way to the Studio. An archived version is not in the history:
 * its number shows alone.
 */
export function RunAgentFacts({
  agent,
  agentParams,
  revision,
  versions,
  canOpenStudio,
  children,
}: RunAgentFactsProps) {
  const { t, i18n } = useLingui()
  const [isShowingVersions, setIsShowingVersions] = useState(false)
  const version = versions.find((candidate) => candidate.revision === revision)
  const versionName = (
    <Trans comment="A version of an agent, by its number">Version {revision}</Trans>
  )
  return (
    <>
      <dl className="flex flex-col gap-4 text-sm">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <span className="flex shrink-0 text-muted-foreground [&_svg]:size-5">
            <AgentTypeIcon type={agent.type} />
          </span>
          <div className="flex min-w-0 flex-col">
            <dt className="sr-only">
              <Trans comment="The agent a run asked">Agent</Trans>
            </dt>
            <dd className="truncate font-medium">{agent.name}</dd>
            <dd className="text-muted-foreground">{i18n._(AGENT_TYPE_LABELS[agent.type])}</dd>
          </div>
        </div>
        <RunFact label={<Trans comment="The version of the agent a run asked">Version</Trans>}>
          {version ? (
            <Button
              variant="link"
              className="h-auto p-0"
              aria-label={t`Compare version ${revision} with the others`}
              onClick={() => setIsShowingVersions(true)}
            >
              {versionName}
            </Button>
          ) : (
            versionName
          )}
        </RunFact>
        {children}
        {canOpenStudio ? (
          <ExternalLink href={studioAgentPathOf(agentParams)} className="inline-flex gap-1">
            <Trans comment="A link to the page of the agent in the Studio, where it is set up">
              Open in Studio
            </Trans>
          </ExternalLink>
        ) : null}
      </dl>
      {version && isShowingVersions ? (
        <AgentVersionsSheet
          isOpen
          onOpenChange={setIsShowingVersions}
          agentName={agent.name}
          versions={versions}
          selectedId={version.id}
          selectedNote={<Trans>The run used this version</Trans>}
          onSelect={null}
        />
      ) : null}
    </>
  )
}
