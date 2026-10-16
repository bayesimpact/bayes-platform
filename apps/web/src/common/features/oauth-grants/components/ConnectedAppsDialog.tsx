import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { useTranslation } from "react-i18next"
import { ConnectedAppsList } from "./ConnectedAppsList"

type Props = {
  open: boolean
  onClose: () => void
}

/** MCP clients the signed-in person connected through the OAuth consent page (ADR 0028). */
export function ConnectedAppsDialog({ open, onClose }: Props) {
  const { t } = useTranslation("oauthGrants")
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {/* The dialog content mounts on open, so the list reloads at each opening. */}
        <ConnectedAppsList />
      </DialogContent>
    </Dialog>
  )
}
