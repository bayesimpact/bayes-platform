import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/app-ui/components/tabs"
import type {
  AgentParamsDto,
  AgentTypeDto,
  ExtractionDatasetOutputDto,
  ExtractionRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { RunAgentFacts } from "@/components/shared/RunAgentFacts"
import { RunFact } from "@/components/shared/RunFact"
import { SidePanel } from "@/components/shared/SidePanel"
import { agentVersionsQueryOptions } from "@/features/agents"
import { DOCUMENT_SEARCH_LABELS } from "@/lib/document-search-labels"

export type ExtractionRunPanelProps = {
  run: ExtractionRunOutputDto
  /** The dataset the run asked: its columns name what each field is compared with. */
  dataset: ExtractionDatasetOutputDto
  /** The agent the run asked: its name and its type. */
  agent: { name: string; type: AgentTypeDto }
  agentParams: AgentParamsDto
  /** Whether the person opens the Studio of the project, where the agent is set up. */
  canOpenStudio: boolean
  onClose: () => void
  takesFocus: boolean
}

/**
 * The side panel of an extraction run's page: what the run used, in two tabs. Agent: the agent,
 * its type, the version the run asked, which opens the history of its versions to compare it, its
 * model and its instructions. Fields: each field the agent returns, with the column of the
 * dataset it is compared with.
 */
export function ExtractionRunPanel({
  run,
  dataset,
  agent,
  agentParams,
  canOpenStudio,
  onClose,
  takesFocus,
}: ExtractionRunPanelProps) {
  const { i18n } = useLingui()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const revision = run.agentRevision
  // An archived version is not in the history: its number shows alone, with no model.
  const version = versions.find((candidate) => candidate.revision === revision)
  return (
    <SidePanel title={<Trans>Agent and fields</Trans>} onClose={onClose} takesFocus={takesFocus}>
      <Tabs defaultValue="agent">
        <TabsList variant="line">
          <TabsTrigger value="agent">
            <Trans comment="The tab of what a run used about its agent">Agent</Trans>
          </TabsTrigger>
          <TabsTrigger value="fields">
            <Trans comment="The tab of the fields an extraction run reads">Fields</Trans>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="agent" className="pt-2">
          <RunAgentFacts
            agent={agent}
            agentParams={agentParams}
            revision={run.agentRevision}
            versions={versions}
            canOpenStudio={canOpenStudio}
          >
            {version ? (
              <>
                <RunFact label={<Trans comment="The model of the agent in a run">Model</Trans>}>
                  <span className="font-mono text-xs">{version.model}</span>
                </RunFact>
                <RunFact
                  label={
                    <Trans comment="Which documents the agent searched in a run">
                      Document search
                    </Trans>
                  }
                >
                  {i18n._(DOCUMENT_SEARCH_LABELS[version.documentsRagMode])}
                </RunFact>
                <RunFact
                  label={
                    <Trans comment="The instructions of the agent in a run">Instructions</Trans>
                  }
                >
                  <p className="rounded-md border bg-muted/40 p-2 whitespace-pre-wrap wrap-anywhere">
                    {version.instructions}
                  </p>
                </RunFact>
                <RunFact
                  label={
                    <Trans comment="The schema of what an extraction agent returns">
                      Output schema
                    </Trans>
                  }
                >
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap wrap-anywhere">
                    {JSON.stringify(version.outputJsonSchema ?? {}, null, 2)}
                  </pre>
                </RunFact>
              </>
            ) : (
              <p className="text-muted-foreground">
                <Trans>This version was archived: its settings no longer show.</Trans>
              </p>
            )}
          </RunAgentFacts>
        </TabsContent>
        <TabsContent value="fields" className="pt-2">
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {run.keyMapping.map((entry) => {
              const columnName =
                dataset.schemaMapping[entry.datasetColumnId]?.finalName ?? entry.datasetColumnId
              return (
                <li key={entry.agentOutputKey} className="flex flex-col gap-0.5 p-3">
                  <span className="font-mono font-medium">{entry.agentOutputKey}</span>
                  <span className="text-muted-foreground">
                    {entry.mode === "scored" ? (
                      <Trans comment="Under a field of an extraction run: the dataset's column it is compared with">
                        Compared with {columnName}
                      </Trans>
                    ) : (
                      <Trans comment="Under a field of an extraction run that is shown and not compared">
                        Only shown
                      </Trans>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </TabsContent>
      </Tabs>
    </SidePanel>
  )
}
