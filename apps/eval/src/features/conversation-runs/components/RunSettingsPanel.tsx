import type {
  AgentParamsDto,
  AgentTypeDto,
  ConversationRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { AgentTypeIcon } from "@/components/shared/AgentTypeIcon"
import { AgentVersionsSheet } from "@/components/shared/AgentVersionsSheet"
import { ExternalLink } from "@/components/shared/ExternalLink"
import { SidePanel } from "@/components/shared/SidePanel"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { agentVersionsQueryOptions } from "@/features/agents"
import { AGENT_TYPE_LABELS } from "@/lib/agent-type-labels"
import { DOCUMENT_SEARCH_LABELS } from "@/lib/document-search-labels"
import { studioAgentPathOf } from "@/lib/studio-path"
import { temperatureOf, thinkingLevelLabelOf, thinkingLevelOf } from "../thinking-level"

export type RunSettingsPanelProps = {
  run: ConversationRunOutputDto
  /** The agent the run asked: its name and its type. */
  agent: { name: string; type: AgentTypeDto }
  agentParams: AgentParamsDto
  /** Whether the person opens the Studio of the project, where the agent is set up. */
  canOpenStudio: boolean
  onClose: () => void
  takesFocus: boolean
}

/** A fact of the panel: its name, then its value. */
function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-medium">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * The side panel of a run's page: what the run used, in two tabs. Agent: the agent, its type, the
 * version the run asked, which opens the history of its versions to compare it, its model, its
 * thinking level and its instructions. Judge: the model that graded, and what it was told.
 */
export function RunSettingsPanel({
  run,
  agent,
  agentParams,
  canOpenStudio,
  onClose,
  takesFocus,
}: RunSettingsPanelProps) {
  const { t, i18n } = useLingui()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const [isShowingVersions, setIsShowingVersions] = useState(false)
  const revision = run.agentSettings.revision
  // An archived version is not in the history: its number shows alone.
  const version = versions.find((candidate) => candidate.revision === revision)
  const thinkingLevel = thinkingLevelOf(run.agentSettings.providerOptions)
  const thinkingLevelLabel = thinkingLevel ? thinkingLevelLabelOf(thinkingLevel) : null
  const temperature = temperatureOf(run.agentSettings.providerOptions)
  const versionName = (
    <Trans comment="A version of an agent, by its number">Version {revision}</Trans>
  )
  return (
    <SidePanel title={<Trans>Agent and judge</Trans>} onClose={onClose} takesFocus={takesFocus}>
      <Tabs defaultValue="agent">
        <TabsList variant="line">
          <TabsTrigger value="agent">
            <Trans comment="The tab of what a run used about its agent">Agent</Trans>
          </TabsTrigger>
          <TabsTrigger value="judge">
            <Trans comment="The tab of what a run used about its judge">Judge</Trans>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="agent" className="pt-2">
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
            <Fact label={<Trans comment="The version of the agent a run asked">Version</Trans>}>
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
            </Fact>
            <Fact label={<Trans comment="The model of the agent in a run">Model</Trans>}>
              <span className="font-mono text-xs">{run.agentSettings.model}</span>
            </Fact>
            <Fact
              label={
                <Trans comment="How much the agent's model thinks, in a run">Thinking level</Trans>
              }
            >
              {thinkingLevel ? (
                // A level the app does not know shows as the provider names it.
                thinkingLevelLabel ? (
                  i18n._(thinkingLevelLabel)
                ) : (
                  <span className="font-mono text-xs">{thinkingLevel}</span>
                )
              ) : (
                <span className="text-muted-foreground">
                  <Trans comment="A model with no thinking level set">Not set</Trans>
                </span>
              )}
            </Fact>
            {temperature === null ? null : (
              <Fact
                label={
                  <Trans comment="The temperature of the agent's model in a run">Temperature</Trans>
                }
              >
                <span className="tabular-nums">{i18n.number(temperature)}</span>
              </Fact>
            )}
            <Fact
              label={
                <Trans comment="Which documents the agent searched in a run">Document search</Trans>
              }
            >
              {i18n._(DOCUMENT_SEARCH_LABELS[run.agentSettings.documentsRagMode])}
            </Fact>
            <Fact
              label={<Trans comment="The instructions of the agent in a run">Instructions</Trans>}
            >
              <p className="rounded-md border bg-muted/40 p-2 whitespace-pre-wrap wrap-anywhere">
                {run.agentSettings.instructions}
              </p>
            </Fact>
            {canOpenStudio ? (
              <ExternalLink href={studioAgentPathOf(agentParams)} className="inline-flex gap-1">
                <Trans comment="A link to the page of the agent in the Studio, where it is set up">
                  Open in Studio
                </Trans>
              </ExternalLink>
            ) : null}
          </dl>
        </TabsContent>
        <TabsContent value="judge" className="pt-2">
          <dl className="flex flex-col gap-4 text-sm">
            <Fact label={<Trans comment="The model of the judge of a run">Model</Trans>}>
              <span className="font-mono text-xs">{run.judgeModel}</span>
            </Fact>
            <Fact
              label={<Trans comment="The instructions of the judge of a run">Instructions</Trans>}
            >
              <p className="whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                {run.judgeInstructions ?? (
                  <Trans comment="A run whose judge got no instructions">None</Trans>
                )}
              </p>
            </Fact>
          </dl>
        </TabsContent>
      </Tabs>
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
    </SidePanel>
  )
}
