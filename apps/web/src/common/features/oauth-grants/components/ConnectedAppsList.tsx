import { Button } from "@caseai-connect/ui/shad/button"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useMount } from "@/common/hooks/use-mount"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { OAuthGrant } from "../oauth-grants.models"
import { selectOAuthGrants } from "../oauth-grants.selectors"
import { oauthGrantsActions } from "../oauth-grants.slice"
import { listOAuthGrants, revokeOAuthGrant } from "../oauth-grants.thunks"
import { oauthGrantClientLabel } from "../oauth-grants.utils"
import { OAuthGrantRow } from "./OAuthGrantRow"

type Revocation = { grant: OAuthGrant; isRevoking: boolean; error: string | null }

/** Grants of the signed-in person, loaded when the connected apps dialog opens. */
export function ConnectedAppsList() {
  const { t } = useTranslation("oauthGrants")
  const dispatch = useAppDispatch()
  const grants = useAppSelector(selectOAuthGrants)
  const [revocation, setRevocation] = useState<Revocation | null>(null)

  useMount({ actions: oauthGrantsActions })

  const displayName = (grant: OAuthGrant) => oauthGrantClientLabel(grant.client) ?? t("unnamedApp")

  const confirmRevoke = async () => {
    if (!revocation || revocation.isRevoking) return
    const { grant } = revocation
    setRevocation({ grant, isRevoking: true, error: null })
    try {
      await dispatch(revokeOAuthGrant(grant.id)).unwrap()
      setRevocation(null)
    } catch {
      // The confirmation stays open with the reason, where the person clicked.
      setRevocation({ grant, isRevoking: false, error: t("revokeError") })
    }
  }

  const pendingName = revocation ? displayName(revocation.grant) : ""

  return (
    <div className="overflow-hidden rounded-lg border">
      {ADS.isError(grants) ? (
        <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
          <p className="text-sm text-destructive">{grants.error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => dispatch(listOAuthGrants())}
          >
            {t("actions:retry")}
          </Button>
        </div>
      ) : !ADS.isFulfilled(grants) ? (
        <p className="px-4 py-6 text-center text-sm italic text-muted-foreground">
          {t("status:asyncLoading")}
        </p>
      ) : grants.value.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm italic text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {grants.value.map((grant) => (
            <OAuthGrantRow
              key={grant.id}
              grant={grant}
              name={displayName(grant)}
              onRevoke={() => setRevocation({ grant, isRevoking: false, error: null })}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={revocation !== null}
        title={t("revokeTitle", { name: pendingName })}
        description={t("revokeDescription", { name: pendingName })}
        confirmLabel={t("actions:revoke")}
        onConfirm={confirmRevoke}
        onCancel={() => {
          if (!revocation?.isRevoking) setRevocation(null)
        }}
        error={revocation?.error}
        isConfirming={revocation?.isRevoking}
      />
    </div>
  )
}
