import { Badge } from "@caseai-connect/app-ui/components/badge"
import type { ReviewerSessionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { PanelSection } from "@/components/shared/PanelSection"
import { listFormResultFields } from "../form-result"

export type FormResultPanelProps = {
  formResult: NonNullable<ReviewerSessionOutputDto["formResult"]>
}

/** The form the agent filled during the session, field by field. */
export function FormResultPanel({ formResult }: FormResultPanelProps) {
  const fields = listFormResultFields(formResult.schema, formResult.value)
  return (
    <PanelSection
      title={<Trans>Captured form</Trans>}
      description={
        formResult.value === null ? (
          <Trans>The tester left before the agent produced a final value.</Trans>
        ) : undefined
      }
    >
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          <Trans>The agent's form has no field.</Trans>
        </p>
      ) : (
        <dl className="flex flex-col gap-3">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <dt className="flex items-center gap-2 text-sm font-medium">
                {field.label}
                {field.type ? (
                  <Badge variant="outline" className="font-mono">
                    {field.type}
                  </Badge>
                ) : null}
              </dt>
              <dd className="font-mono text-sm break-words">
                {field.value ?? (
                  <span className="font-sans text-muted-foreground italic">
                    <Trans>Not collected</Trans>
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </PanelSection>
  )
}
