import { Button } from "@bayes-platform/ui/shad/button"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import type { McpServerConnection } from "../mcp-servers.models"
import { connectionOf } from "../mcp-servers.selectors"
import type { CreateMcpServerFields, UpdateMcpServerFields } from "../mcp-servers.spi"
import { CreateMcpServerDialog } from "./CreateMcpServerDialog"
import { McpServerItem } from "./McpServerItem"
import type { McpServerDisplay } from "./mcp-servers.types"

export function McpServersList({
  mcpServers,
  connections,
  onDelete,
  onCreate,
  onUpdate,
  onInspect,
  onBack,
  onAuthorize,
}: {
  mcpServers: McpServerDisplay[]
  /** Connection of each inspected server, by server id. */
  connections: Record<string, McpServerConnection>
  onDelete: (id: string) => void
  onCreate: (fields: CreateMcpServerFields, onSuccess: () => void) => void
  onUpdate: (id: string, fields: UpdateMcpServerFields, onSuccess: () => void) => void
  onInspect: (id: string) => void
  onBack: () => void
  onAuthorize: (id: string) => void
}) {
  const { t } = useTranslation()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  return (
    <>
      <Grid cols={mcpServers.length === 0 ? 0 : 3}>
        <GridHeader
          onBack={onBack}
          title={t("mcpServers:title")}
          description={t("mcpServers:description")}
          action={
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <PlusIcon className="size-4" /> {t("mcpServers:actions.newServer")}
            </Button>
          }
        />
        <GridContent>
          {mcpServers.length === 0 ? (
            <GridCard span="full">
              <GridCard.Body>
                <GridCard.Description>{t("mcpServers:empty")}</GridCard.Description>
              </GridCard.Body>
            </GridCard>
          ) : (
            mcpServers.map((mcpServer) => (
              <McpServerItem
                key={mcpServer.id}
                mcpServer={mcpServer}
                connection={connectionOf(connections, mcpServer.id)}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onInspect={onInspect}
                onAuthorize={onAuthorize}
              />
            ))
          )}
        </GridContent>
      </Grid>

      <CreateMcpServerDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={onCreate}
      />
    </>
  )
}
