import type { TermsDocumentDto } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import { useMemo, useState } from "react"
import { useAppDispatch } from "@/common/store/hooks"
import type { TermsDocuments } from "../backoffice.models"
import { backofficeActions } from "../backoffice.slice"

type FormState = {
  generalConditions: { url: string; version: string }
  privacyPolicy: { url: string; version: string }
  aiUsagePolicy: { url: string; version: string }
}

type DocumentKey = keyof FormState

const DOCUMENT_LABELS: Record<DocumentKey, string> = {
  generalConditions: "General Conditions of Service (CGS)",
  privacyPolicy: "Privacy Policy",
  aiUsagePolicy: "AI Systems Usage Policy",
}

export function TermsDocumentsPanel({ documents }: { documents: TermsDocuments }) {
  const dispatch = useAppDispatch()

  const initialState = useMemo<FormState>(
    () => ({
      generalConditions: toFormFields(documents.generalConditions),
      privacyPolicy: toFormFields(documents.privacyPolicy),
      aiUsagePolicy: toFormFields(documents.aiUsagePolicy),
    }),
    [documents],
  )

  const [form, setForm] = useState<FormState>(initialState)
  const [validationError, setValidationError] = useState<string | null>(null)

  const updateField = (key: DocumentKey, field: "url" | "version", value: string) => {
    setForm((previous) => ({ ...previous, [key]: { ...previous[key], [field]: value } }))
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const error = validateForm(form, documents)
    if (error) {
      setValidationError(error)
      return
    }
    setValidationError(null)
    dispatch(
      backofficeActions.updateTermsDocuments({
        generalConditions: {
          url: form.generalConditions.url.trim(),
          version: Number(form.generalConditions.version),
        },
        privacyPolicy: {
          url: form.privacyPolicy.url.trim(),
          version: Number(form.privacyPolicy.version),
        },
        aiUsagePolicy: {
          url: form.aiUsagePolicy.url.trim(),
          version: Number(form.aiUsagePolicy.version),
        },
      }),
    )
  }

  return (
    <form className="flex flex-col gap-6 p-6" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">
        Update the public URL and version for each document. Versions are incremental — bumping a
        version (or changing a URL) forces all users to re-accept on their next visit.
      </p>

      {(Object.keys(DOCUMENT_LABELS) as DocumentKey[]).map((key) => (
        <DocumentRow
          key={key}
          label={DOCUMENT_LABELS[key]}
          current={pickCurrent(documents, key)}
          fields={form[key]}
          onChange={(field, value) => updateField(key, field, value)}
        />
      ))}

      {validationError && <p className="text-sm text-destructive">{validationError}</p>}

      <div>
        <Button type="submit">Save</Button>
      </div>
    </form>
  )
}

function DocumentRow({
  label,
  current,
  fields,
  onChange,
}: {
  label: string
  current: TermsDocumentDto
  fields: { url: string; version: string }
  onChange: (field: "url" | "version", value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 border rounded-md p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground">
          Current: v{current.version} — {current.url}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${label}-url`}>URL</Label>
          <Input
            id={`${label}-url`}
            type="url"
            value={fields.url}
            onChange={(event) => onChange("url", event.target.value)}
            placeholder="https://example.com/document"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${label}-version`}>Version</Label>
          <Input
            id={`${label}-version`}
            type="number"
            min={1}
            step={1}
            value={fields.version}
            onChange={(event) => onChange("version", event.target.value)}
            required
          />
        </div>
      </div>
    </div>
  )
}

function toFormFields(document: TermsDocumentDto): { url: string; version: string } {
  return { url: document.url, version: String(document.version) }
}

function pickCurrent(documents: TermsDocuments, key: DocumentKey): TermsDocumentDto {
  if (key === "generalConditions") return documents.generalConditions
  if (key === "privacyPolicy") return documents.privacyPolicy
  return documents.aiUsagePolicy
}

function validateForm(form: FormState, current: TermsDocuments): string | null {
  const entries: Array<{ key: DocumentKey; label: string; document: TermsDocumentDto }> = [
    {
      key: "generalConditions",
      label: DOCUMENT_LABELS.generalConditions,
      document: current.generalConditions,
    },
    { key: "privacyPolicy", label: DOCUMENT_LABELS.privacyPolicy, document: current.privacyPolicy },
    { key: "aiUsagePolicy", label: DOCUMENT_LABELS.aiUsagePolicy, document: current.aiUsagePolicy },
  ]

  for (const entry of entries) {
    const fields = form[entry.key]
    const url = fields.url.trim()
    const version = Number(fields.version)

    if (!url || !/^https?:\/\//i.test(url)) {
      return `${entry.label}: URL must be a valid http(s) link`
    }
    if (!Number.isInteger(version) || version < 1) {
      return `${entry.label}: version must be a positive integer`
    }

    const urlChanged = entry.document.url !== url
    const versionChanged = entry.document.version !== version

    if (urlChanged && version <= entry.document.version) {
      return `${entry.label}: bump the version above ${entry.document.version} when changing the URL`
    }
    if (!urlChanged && versionChanged && version <= entry.document.version) {
      return `${entry.label}: version can only be incremented (current: ${entry.document.version})`
    }
  }

  return null
}
