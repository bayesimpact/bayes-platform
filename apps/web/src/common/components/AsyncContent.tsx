import { Loader2Icon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { AsyncData } from "@/common/store/async-data-status"
import { ADS } from "@/common/store/async-data-status"

/**
 * Inline counterpart of AsyncRoute: renders children once every item is fulfilled,
 * with small loading and error fallbacks that fit inside a card, a dialog or a table cell.
 */
export function AsyncContent<T extends readonly AsyncData<unknown>[]>({
  data,
  children,
  loading,
  error,
}: {
  data: [...T]
  children: ReactNode
  loading?: ReactNode
  error?: (message: string) => ReactNode
}): ReactNode {
  const errorItem = data.find((item) => ADS.isError(item))
  if (errorItem) {
    const message = errorItem.error || "Unknown error"
    return error ? error(message) : <InlineError message={message} />
  }

  if (data.every((item) => ADS.isFulfilled(item))) {
    return children
  }

  return loading ?? <InlineLoader />
}

function InlineLoader() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" />
      <span className="capitalize-first">{t("status:loading")}</span>
    </span>
  )
}

function InlineError({ message }: { message: string }) {
  return <span className="text-sm text-muted-foreground">{message}</span>
}
