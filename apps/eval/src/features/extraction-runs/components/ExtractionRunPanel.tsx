import type {
  AgentParamsDto,
  AgentTypeDto,
  ExtractionDatasetOutputDto,
  ExtractionRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { AgentTypeIcon } from "@/components/shared/AgentTypeIcon"
import { ExternalLink } from "@/components/shared/ExternalLink"
import { SidePanel } from "@/components/shared/SidePanel"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgentVersionsSheet, agentVersionsQueryOptions } from "@/features/campaigns"
import { AGENT_TYPE_LABELS } from "@/lib/agent-type-labels"
import { DOCUMENT_SEARCH_LABELS } from "@/lib/document-search-labels"
import { studioAgentPathOf } from "@/lib/studio-path"

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
  const { t, i18n } = useLingui()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const [isShowingVersions, setIsShowingVersions] = useState(false)
  const revision = run.agentRevision
  // An archived version is not in the history: its number shows alone, with no model.
  const version = versions.find((candidate) => candidate.revision === revision)
  const versionName = (
    <Trans comment="A version of an agent, by its number">Version {revision}</Trans>
  )
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
            {version ? (
              <>
                <Fact label={<Trans comment="The model of the agent in a run">Model</Trans>}>
                  <span className="font-mono text-xs">{version.model}</span>
                </Fact>
                <Fact
                  label={
                    <Trans comment="Which documents the agent searched in a run">
                      Document search
                    </Trans>
                  }
                >
                  {i18n._(DOCUMENT_SEARCH_LABELS[version.documentsRagMode])}
                </Fact>
                <Fact
                  label={
                    <Trans comment="The instructions of the agent in a run">Instructions</Trans>
                  }
                >
                  <p className="rounded-md border bg-muted/40 p-2 whitespace-pre-wrap wrap-anywhere">
                    {version.instructions}
                  </p>
                </Fact>
                <Fact
                  label={
                    <Trans comment="The schema of what an extraction agent returns">
                      Output schema
                    </Trans>
                  }
                >
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap wrap-anywhere">
                    {JSON.stringify(version.outputJsonSchema ?? {}, null, 2)}
                  </pre>
                </Fact>
              </>
            ) : (
              <p className="text-muted-foreground">
                <Trans>This version was archived: its settings no longer show.</Trans>
              </p>
            )}
            {canOpenStudio ? (
              <ExternalLink href={studioAgentPathOf(agentParams)} className="inline-flex gap-1">
                <Trans comment="A link to the page of the agent in the Studio, where it is set up">
                  Open in Studio
                </Trans>
              </ExternalLink>
            ) : null}
          </dl>
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
      {version && isShowingVersions ? (
        <AgentVersionsSheet
          isOpen
          onOpenChange={setIsShowingVersions}
          agentName={agent.name}
          versions={versions}
          selectedId={version.id}
          selectedNote={<Trans>The run asked this version</Trans>}
          onSelect={null}
        />
      ) : null}
    </SidePanel>
  )
}
