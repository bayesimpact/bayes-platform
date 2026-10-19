import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react"
import { useState } from "react"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { useAppDispatch } from "@/common/store/hooks"
import type { AppManifest, AppOAuthClient } from "../backoffice.models"
import { backofficeActions } from "../backoffice.slice"

/** Opens the OAuth client of an app, loaded when the button is clicked. */
export function AppOAuthClientButton({ manifest }: { manifest: AppManifest }) {
  const dispatch = useAppDispatch()
  const [client, setClient] = useState<AppOAuthClient | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const open = async () => {
    setIsLoading(true)
    try {
      setClient(await dispatch(backofficeActions.getAppOAuthClient(manifest.id)).unwrap())
    } catch {
      // The middleware shows the error notification.
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={open} disabled={isLoading}>
        <KeyRoundIcon className="size-4" />
        OAuth client
      </Button>
      {client && (
        <AppOAuthClientDialog manifest={manifest} client={client} onClose={() => setClient(null)} />
      )}
    </>
  )
}

function AppOAuthClientDialog({
  manifest,
  client,
  onClose,
}: {
  manifest: AppManifest
  client: AppOAuthClient
  onClose: () => void
}) {
  const dispatch = useAppDispatch()
  const [clientId, setClientId] = useState(client.clientId)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const createSecret = async () => {
    setIsCreating(true)
    try {
      const created = await dispatch(
        backofficeActions.createAppOAuthClientSecret(manifest.id),
      ).unwrap()
      setClientId(created.clientId)
      setClientSecret(created.clientSecret)
    } catch {
      // The middleware shows the error notification; the current secret still works.
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="min-w-0">
          <DialogTitle>OAuth client of {manifest.name}</DialogTitle>
          <DialogDescription>
            The app signs in with this client: a workspace owner or admin installs it from the
            consent page, then the app gets its tokens with the secret. Any standard OAuth 2.1
            client library works with the issuer below.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          {clientId ? (
            <CopyField label="Client id" value={clientId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This app has no client yet. Create its secret to set it up.
            </p>
          )}
          {clientSecret && (
            <Alert>
              <KeyRoundIcon />
              <AlertTitle>Copy the secret now</AlertTitle>
              <AlertDescription className="flex min-w-0 flex-col gap-2">
                It is shown once. Give it to the app's maintainers through a secret manager.
                <CopyField label="Client secret" value={clientSecret} />
              </AlertDescription>
            </Alert>
          )}
          <CopyField label="Issuer" value={client.issuer} />
          <CopyField label="Authorization endpoint" value={client.authorizationEndpoint} />
          <CopyField label="Resource" value={client.resource} />
        </div>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {clientId && "Replacing the secret stops the current one at once."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant={clientId ? "destructive" : "default"}
              onClick={createSecret}
              disabled={isCreating}
            >
              {clientId ? "Replace secret" : "Create secret"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const { copy, isCopied } = useCopyToClipboard("Copied")
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
          {value}
        </code>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => copy(value)}
        >
          {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
