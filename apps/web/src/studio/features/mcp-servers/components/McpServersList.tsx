import { Button } from "@caseai-connect/ui/shad/button"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { CreateMcpServerDialog } from "./CreateMcpServerDialog"
import { McpServerItem } from "./McpServerItem"
import type { McpServerDisplay } from "./mcp-servers.types"

export function McpServersList({
  mcpServers,
  onDelete,
  onCreate,
  onBack,
}: {
  mcpServers: McpServerDisplay[]
  onDelete: (id: string) => void
  onCreate: (values: { name: string; url: string; apiKey?: string }) => void
  onBack: () => void
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
              <McpServerItem key={mcpServer.id} mcpServer={mcpServer} onDelete={onDelete} />
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
