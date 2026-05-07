import type { ReviewerFormResultDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { useTranslation } from "react-i18next"
import { collectFormDisplayKeys } from "@/common/features/agents/agent-sessions/form/output-schema-keys.helpers"

type Props = {
  result: ReviewerFormResultDto
}

type SchemaProperty = {
  title?: string
  description?: string
  type?: string
}

/**
 * Read-only rendering of a form-agent session's collected JSON.
 *
 * Field list is built by walking `schema.properties` and any conditional
 * `then` / `else` branches, then unioned with the keys actually present in
 * `value`. `value` is null if the user abandoned the session mid-flow.
 */
export function FormResultPanel({ result }: Props) {
  const { t } = useTranslation()
  const properties = extractProperties(result.schema)
  const keys = collectFormDisplayKeys(result.schema, result.value)

  if (keys.length === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">{t("reviewerCampaigns:formResult.title")}</h3>
        <p className="text-muted-foreground text-sm italic">
          {t("reviewerCampaigns:formResult.noFields")}
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header>
        <h3 className="text-sm font-semibold">{t("reviewerCampaigns:formResult.title")}</h3>
        {result.value === null && (
          <p className="text-muted-foreground text-xs">
            {t("reviewerCampaigns:formResult.abandoned")}
          </p>
        )}
      </header>
      <dl className="flex flex-col gap-3">
        {keys.map((key) => {
          const property = properties[key] ?? {}
          const label = property.title ?? key
          const captured = result.value ? result.value[key] : undefined
          return (
            <div key={key} className="flex flex-col gap-1">
              <dt className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                {label}
                {property.type && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {property.type}
                  </Badge>
                )}
              </dt>
              <dd>
                <RenderedValue value={captured} />
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

function extractProperties(schema: Record<string, unknown>): Record<string, SchemaProperty> {
  const collected: Record<string, SchemaProperty> = {}
  collectProperties(schema, collected)
  return collected
}

function collectProperties(node: unknown, into: Record<string, SchemaProperty>) {
  if (!node || typeof node !== "object") return
  const record = node as Record<string, unknown>
  const rawProperties = record.properties
  if (rawProperties && typeof rawProperties === "object") {
    for (const [key, value] of Object.entries(rawProperties as Record<string, unknown>)) {
      if (key in into) continue
      if (!value || typeof value !== "object") {
        into[key] = {}
        continue
      }
      const valueRecord = value as Record<string, unknown>
      into[key] = {
        title: typeof valueRecord.title === "string" ? valueRecord.title : undefined,
        description:
          typeof valueRecord.description === "string" ? valueRecord.description : undefined,
        type: typeof valueRecord.type === "string" ? valueRecord.type : undefined,
      }
    }
  }
  collectProperties(record.then, into)
  collectProperties(record.else, into)
}

function RenderedValue({ value }: { value: unknown }) {
  const { t } = useTranslation()
  if (value === undefined || value === null || value === "") {
    return (
      <span className="text-muted-foreground text-sm italic">
        {t("reviewerCampaigns:formResult.notCollected")}
      </span>
    )
  }
  if (Array.isArray(value)) {
    return <span className="font-mono text-sm">{value.join(", ")}</span>
  }
  if (typeof value === "object") {
    return <span className="font-mono text-sm">{JSON.stringify(value)}</span>
  }
  return <span className="font-mono text-sm">{String(value)}</span>
}
