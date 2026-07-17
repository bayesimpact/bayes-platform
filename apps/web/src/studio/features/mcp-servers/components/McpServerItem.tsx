import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridCard } from "@/common/components/grid/Grid"
import type { McpServerDisplay } from "./mcp-servers.types"

export function McpServerItem({
  mcpServer,
  onDelete,
}: {
  mcpServer: McpServerDisplay
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  return (
    <>
      <GridCard>
        <GridCard.TopAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("actions:delete")}
            onClick={() => setIsConfirmingDelete(true)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </GridCard.TopAction>
        <GridCard.Body>
          <GridCard.Title>{mcpServer.name}</GridCard.Title>
          <p className="text-base text-muted-foreground leading-snug mt-1 mb-4 truncate">
            {mcpServer.url}
          </p>
        </GridCard.Body>
      </GridCard>

      <ConfirmDialog
        open={isConfirmingDelete}
        title={t("mcpServers:delete.title")}
        description={t("mcpServers:delete.description", { name: mcpServer.name })}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          onDelete(mcpServer.id)
          setIsConfirmingDelete(false)
        }}
      />
    </>
  )
}
