import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { GridHeader } from "@/common/components/grid/Grid"
import { isResourceComplete } from "../resource-libraries.helpers"
import type { Resource } from "../resource-libraries.models"
import { ResourceLinkField } from "./ResourceLinkField"

/**
 * Full-page form to create or edit a single resource. The parent route owns persistence: confirming
 * here calls `onSubmit` with the edited resource and the route saves it into its library.
 */
export function ResourceForm({
  initialResource,
  headerTitle,
  submitLabel,
  onSubmit,
  onBack,
}: {
  initialResource: Resource
  headerTitle: string
  submitLabel: string
  onSubmit: (resource: Resource) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Resource>(initialResource)

  return (
    <div className="flex flex-col">
      <GridHeader onBack={onBack} title={headerTitle} />

      <div className="flex flex-col gap-4 bg-white p-6">
        <Field>
          <FieldLabel htmlFor="resource-title">
            {t("resourceLibrary:resourceForm.titleLabel")}
          </FieldLabel>
          <Input
            id="resource-title"
            placeholder={t("resourceLibrary:resourceForm.titlePlaceholder")}
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="resource-description">
            {t("resourceLibrary:resourceForm.descriptionLabel")}
          </FieldLabel>
          <Textarea
            id="resource-description"
            placeholder={t("resourceLibrary:resourceForm.descriptionPlaceholder")}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="resource-matching-hints">
            {t("resourceLibrary:resourceForm.matchingHintsLabel")}
          </FieldLabel>
          <Textarea
            id="resource-matching-hints"
            placeholder={t("resourceLibrary:resourceForm.matchingHintsPlaceholder")}
            value={draft.matchingHints ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, matchingHints: event.target.value || undefined })
            }
          />
        </Field>

        <ResourceLinkField resource={draft} onChange={setDraft} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            {t("actions:cancel")}
          </Button>
          <Button
            type="button"
            disabled={!isResourceComplete(draft)}
            onClick={() => onSubmit(draft)}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
