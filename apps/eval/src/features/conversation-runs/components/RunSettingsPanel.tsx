import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/app-ui/components/tabs"
import type {
  AgentParamsDto,
  AgentTypeDto,
  ConversationRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { RunAgentFacts } from "@/components/shared/RunAgentFacts"
import { RunFact } from "@/components/shared/RunFact"
import { SidePanel } from "@/components/shared/SidePanel"
import { agentVersionsQueryOptions } from "@/features/agents"
import { DOCUMENT_SEARCH_LABELS } from "@/lib/document-search-labels"
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
  const { i18n } = useLingui()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const thinkingLevel = thinkingLevelOf(run.agentSettings.providerOptions)
  const thinkingLevelLabel = thinkingLevel ? thinkingLevelLabelOf(thinkingLevel) : null
  const temperature = temperatureOf(run.agentSettings.providerOptions)
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
          <RunAgentFacts
            agent={agent}
            agentParams={agentParams}
            revision={run.agentSettings.revision}
            versions={versions}
            canOpenStudio={canOpenStudio}
          >
            <RunFact label={<Trans comment="The model of the agent in a run">Model</Trans>}>
              <span className="font-mono text-xs">{run.agentSettings.model}</span>
            </RunFact>
            <RunFact
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
            </RunFact>
            {temperature === null ? null : (
              <RunFact
                label={
                  <Trans comment="The temperature of the agent's model in a run">Temperature</Trans>
                }
              >
                <span className="tabular-nums">{i18n.number(temperature)}</span>
              </RunFact>
            )}
            <RunFact
              label={
                <Trans comment="Which documents the agent searched in a run">Document search</Trans>
              }
            >
              {i18n._(DOCUMENT_SEARCH_LABELS[run.agentSettings.documentsRagMode])}
            </RunFact>
            <RunFact
              label={<Trans comment="The instructions of the agent in a run">Instructions</Trans>}
            >
              <p className="rounded-md border bg-muted/40 p-2 whitespace-pre-wrap wrap-anywhere">
                {run.agentSettings.instructions}
              </p>
            </RunFact>
          </RunAgentFacts>
        </TabsContent>
        <TabsContent value="judge" className="pt-2">
          <dl className="flex flex-col gap-4 text-sm">
            <RunFact label={<Trans comment="The model of the judge of a run">Model</Trans>}>
              <span className="font-mono text-xs">{run.judgeModel}</span>
            </RunFact>
            <RunFact
              label={<Trans comment="The instructions of the judge of a run">Instructions</Trans>}
            >
              <p className="whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                {run.judgeInstructions ?? (
                  <Trans comment="A run whose judge got no instructions">None</Trans>
                )}
              </p>
            </RunFact>
          </dl>
        </TabsContent>
      </Tabs>
    </SidePanel>
  )
}
