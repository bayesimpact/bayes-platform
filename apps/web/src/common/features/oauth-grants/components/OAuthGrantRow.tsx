import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { PlugIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { OAuthClientTrustBadge } from "@/common/features/oauth-consent/components/OAuthClientTrustBadge"
import { buildDate, buildSince } from "@/common/utils/build-date"
import type { OAuthGrant } from "../oauth-grants.models"

export function OAuthGrantRow({
  grant,
  name,
  onRevoke,
}: {
  grant: OAuthGrant
  /** Display name of the client, resolved by the list. */
  name: string
  onRevoke: () => void
}) {
  const { t } = useTranslation("oauthGrants")
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="hidden size-8 shrink-0 sm:flex items-center justify-center rounded-md border bg-muted text-muted-foreground">
          <PlugIcon className="size-4" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all text-sm font-medium">{name}</span>
            <OAuthClientTrustBadge verified={grant.client.verified} />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="sr-only">{t("projects")}: </span>
            {grant.projects.map((project) => project.name).join(", ")}
          </p>
          <div className="flex flex-wrap gap-1">
            <span className="sr-only">{t("permissions")}: </span>
            {grant.permissions.map((permission) => (
              <Badge key={permission} variant="outline">
                {t(`oauthConsent:permission.${permission.replaceAll(".", "_")}.name`, {
                  defaultValue: permission,
                })}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("connectedOn", { date: buildDate(grant.createdAt, "d MMMM yyyy") })}
            {" · "}
            {grant.lastUsedAt === null
              ? t("neverUsed")
              : t("lastUsed", { since: buildSince(grant.lastUsedAt) })}
          </p>
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onRevoke}>
        {t("actions:revoke")}
      </Button>
    </li>
  )
}
