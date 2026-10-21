import type { ConversationFormOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { ClipboardListIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { FormFields } from "./FormFields"

export type FormsSheetProps = {
  forms: ConversationFormOutputDto[]
}

/**
 * The forms the agents fill in from what the person tells them, in a panel on the side. They
 * update while the conversation goes on.
 */
export function FormsSheet({ forms }: FormsSheetProps) {
  const { t } = useLingui()
  const isInProgress = forms.some((form) => form.status === "in_progress")
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <ClipboardListIcon aria-hidden />
        {isInProgress ? <Trans>Form in progress</Trans> : <Trans>Completed form</Trans>}
      </SheetTrigger>
      <SheetContent showCloseButton={false} className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2">
            <SheetTitle>
              <Trans>What the agent noted</Trans>
            </SheetTitle>
            <SheetClose render={<Button variant="ghost" size="icon-sm" aria-label={t`Close`} />}>
              <XIcon aria-hidden />
            </SheetClose>
          </div>
          <SheetDescription>
            <Trans>
              The answers the agent collected from the conversation, as it fills them in.
            </Trans>
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          {forms.map((form) => (
            <section key={form.agentId} className="flex flex-col gap-3">
              {forms.length > 1 ? (
                <h3 className="font-medium">{form.agentName ?? <Trans>Agent</Trans>}</h3>
              ) : null}
              <FormFields form={form} />
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
