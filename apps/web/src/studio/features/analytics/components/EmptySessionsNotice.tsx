import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { InfoIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

/** Above this share of empty sessions, the notice becomes a warning about the integration. */
const EMPTY_SESSION_WARNING_RATIO = 0.5

type EmptySessionsNoticeProps = {
  /** Sessions with at least one user message over the period. */
  conversationTotal: number
  /** Sessions opened over the period without any user message. */
  emptySessionTotal: number
}

/**
 * Sessions without a user message are not counted as conversations. This notice says how many
 * were left out, so that an embed client that opens a session on every page load is visible.
 */
export function EmptySessionsNotice({
  conversationTotal,
  emptySessionTotal,
}: EmptySessionsNoticeProps) {
  const { t, i18n } = useTranslation("analytics")
  if (emptySessionTotal === 0) return null

  const sessionTotal = conversationTotal + emptySessionTotal
  const emptyRatio = emptySessionTotal / sessionTotal
  const values = {
    emptyCount: emptySessionTotal.toLocaleString(i18n.language),
    sessionCount: sessionTotal.toLocaleString(i18n.language),
    share: emptyRatio.toLocaleString(i18n.language, { style: "percent", maximumFractionDigits: 0 }),
  }

  if (emptyRatio >= EMPTY_SESSION_WARNING_RATIO) {
    return (
      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>{t("emptySessions.warning.title")}</AlertTitle>
        <AlertDescription>{t("emptySessions.warning.description", values)}</AlertDescription>
      </Alert>
    )
  }

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <InfoIcon className="size-4 shrink-0" />
      {t("emptySessions.note", { ...values, count: emptySessionTotal })}
    </p>
  )
}
