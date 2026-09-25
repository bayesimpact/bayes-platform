import { DOCUMENT_CREATE_PERMISSION } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import type { ProjectAppInstallation } from "@/common/features/app-install/app-install.models"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { runtimeConfig } from "@/config/runtime-config"

export function InstallationInstructionsButton({
  installation,
  projectId,
}: {
  installation: ProjectAppInstallation
  projectId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  if (!installation.clientId) return null

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(true)}>
        How to use
      </Button>
      <InstallationInstructionsDialog
        open={isOpen}
        appName={installation.appName}
        clientId={installation.clientId}
        projectId={projectId}
        permissions={installation.permissions}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

function InstallationInstructionsDialog({
  open,
  appName,
  clientId,
  projectId,
  permissions,
  onClose,
}: {
  open: boolean
  appName: string
  clientId: string
  projectId: string
  permissions: string[]
  onClose: () => void
}) {
  const commands = buildUsageCommands({
    apiBase: runtimeConfig.apiUrl,
    clientId,
    projectId,
    canCreateDocuments: permissions.includes(DOCUMENT_CREATE_PERMISSION),
  })

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="min-w-0">
          <DialogTitle>How to use {appName}</DialogTitle>
          <DialogDescription>
            The client secret was shown once when this app was installed. It cannot be retrieved
            later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          <CopyField label="Client id" value={clientId} />
          <CopyField label="Project id" value={projectId} />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Commands</span>
              <CopyButton value={commands} label="Copy commands" />
            </div>
            <div className="min-w-0 overflow-auto overscroll-contain rounded-md border bg-muted/50">
              <pre className="w-max p-3 font-mono text-xs leading-5">{commands}</pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
          {value}
        </code>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { copy, isCopied } = useCopyToClipboard("Copied")
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      onClick={() => copy(value)}
    >
      {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
    </Button>
  )
}

function buildUsageCommands({
  apiBase,
  clientId,
  projectId,
  canCreateDocuments,
}: {
  apiBase: string
  clientId: string
  projectId: string
  canCreateDocuments: boolean
}): string {
  const base = apiBase.replace(/\/$/, "")
  const lines = [
    "# Request an access token. Use the client secret printed at install.",
    `curl -s -X POST '${base}/apps/v1/token' \\`,
    "  -d grant_type=client_credentials \\",
    `  -d client_id='${clientId}' \\`,
    "  -d client_secret='<the secret you saved>'",
    "",
    "# Call the API with that token.",
    `curl -s '${base}/apps/v1/me' \\`,
    "  -H 'Authorization: Bearer <access_token>'",
  ]
  if (canCreateDocuments) {
    lines.push(
      "",
      "# Create a document on this project.",
      `curl -s -X POST '${base}/apps/v1/projects/${projectId}/documents' \\`,
      "  -H 'Authorization: Bearer <access_token>' \\",
      "  -H 'Content-Type: application/json' \\",
      `  -d '{"title":"Note","content":"Hello"}'`,
    )
  }
  return lines.join("\n")
}
