import type { ConversationFormOutputDto } from "@caseai-connect/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { SidePanel } from "@/components/shared/SidePanel"
import { FormFields } from "./FormFields"

export type FormsPanelProps = {
  forms: ConversationFormOutputDto[]
  onClose: () => void
}

/**
 * The forms the agents fill in from what the person tells them, in the side panel. They update
 * while the conversation goes on.
 */
export function FormsPanel({ forms, onClose }: FormsPanelProps) {
  return (
    <SidePanel
      title={<Trans>What the agent noted</Trans>}
      description={
        <Trans>The answers the agent collected from the conversation, as it fills them in.</Trans>
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-6">
        {forms.map((form) => (
          <section key={form.agentId} className="flex flex-col gap-3">
            {forms.length > 1 ? (
              <h3 className="font-medium">
                {form.agentName ?? (
                  <Trans
                    context="form"
                    comment="The agent that fills in a form, when it has no name"
                  >
                    Agent
                  </Trans>
                )}
              </h3>
            ) : null}
            <FormFields form={form} />
          </section>
        ))}
      </div>
    </SidePanel>
  )
}
