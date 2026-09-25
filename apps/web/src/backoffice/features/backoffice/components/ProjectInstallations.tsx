import { Button } from "@caseai-connect/ui/shad/button"
import { GlobeIcon } from "lucide-react"
import { useState } from "react"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import type { ProjectAppInstallation } from "@/common/features/app-install/app-install.models"
import { revokeAppInstallation } from "@/common/features/app-install/app-install.thunks"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import { useAppDispatch } from "@/common/store/hooks"
import { InstallationInstructionsButton } from "./InstallationInstructions"

export function ProjectInstallations({
  installations,
  projectId,
}: {
  installations: AsyncData<ProjectAppInstallation[]>
  projectId: string
}) {
  const dispatch = useAppDispatch()
  const [pending, setPending] = useState<ProjectAppInstallation | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const installed = ADS.isFulfilled(installations) ? installations.value : null

  const confirmRevoke = async () => {
    if (!pending || isRevoking) return
    setIsRevoking(true)
    try {
      await dispatch(revokeAppInstallation(pending.id)).unwrap()
      setPending(null)
    } catch {
      // The app-install middleware shows the error.
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b">
        <h3 className="text-sm font-medium text-muted-foreground">Apps</h3>
      </div>
      {installed === null ? (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center italic">
          {ADS.isError(installations) ? installations.error : "Loading apps…"}
        </p>
      ) : installed.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center italic">
          No apps installed on this project.
        </p>
      ) : (
        <ul className="divide-y">
          {installed.map((installation) => (
            <li key={installation.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <AppLogo logoUrl={installation.logoUrl} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium">{installation.appName}</span>
                  {installation.description && (
                    <span className="text-xs text-muted-foreground">
                      {installation.description}
                    </span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {installation.permissions.join(", ") || "—"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <InstallationInstructionsButton installation={installation} projectId={projectId} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPending(installation)}
                >
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pending !== null}
        title={pending ? `Revoke ${pending.appName}?` : "Revoke app?"}
        description="New access tokens stop immediately. A token that was already issued keeps working until it expires."
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
        onCancel={() => {
          if (!isRevoking) setPending(null)
        }}
      />
    </div>
  )
}

function AppLogo({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="size-8 shrink-0 rounded-md border bg-muted object-contain"
      />
    )
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
      <GlobeIcon className="size-4" aria-hidden />
    </div>
  )
}
