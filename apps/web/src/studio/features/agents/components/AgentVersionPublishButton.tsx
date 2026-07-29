import { agentPublishSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { UploadCloudIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { publishAgentSettings } from "@/common/features/agents/settings/agent-settings.thunks"
import { useAppDispatch } from "@/common/store/hooks"

type FormValues = z.infer<typeof agentPublishSchema>

/**
 * Publishes a draft revision: makes it the live settings the running agent serves. The dialog
 * pre-fills the name and description already stored for this revision, so leaving a field as-is
 * preserves it (the API keeps the stored value when the field is omitted). Deliberately clearing
 * a field (the user edits it and leaves it empty) clears the stored value instead, so submission
 * reads the form's dirty state rather than guessing from the string alone: an untouched,
 * pre-filled field and a field the user cleared can both end up empty.
 */
export function AgentVersionPublishButton({
  agentId,
  revision,
  revisionName,
  revisionDesc,
}: {
  agentId: string
  revision: number
  /** The name and description already stored for this revision, so the dialog pre-fills them:
   * an untouched pre-filled field stays non-dirty and preserves the stored value, and clearing a
   * pre-filled field makes it dirty and empty, which is a real clear. */
  revisionName: string
  revisionDesc: string
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(agentPublishSchema),
    defaultValues: { revisionName, revisionDesc },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    // Re-read the stored values on every open: the revision being published (or its stored
    // name/desc) may have changed since the form was last reset, e.g. a different revision was
    // selected in the history sheet while this dialog was closed.
    if (nextOpen) form.reset({ revisionName, revisionDesc })
  }

  const handleSubmit = async (values: FormValues) => {
    setIsPublishing(true)
    const { dirtyFields } = form.formState
    try {
      await dispatch(
        publishAgentSettings({
          agentId,
          revision,
          // Untouched (not dirty): undefined, preserve the stored value. Touched but emptied:
          // null, clear it. Touched with content: the trimmed string.
          revisionName: dirtyFields.revisionName ? values.revisionName?.trim() || null : undefined,
          revisionDesc: dirtyFields.revisionDesc ? values.revisionDesc?.trim() || null : undefined,
        }),
      ).unwrap()
      handleOpenChange(false)
    } catch {
      // Success and failure notifications are wired in the settings middleware.
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <>
      <Button size="sm" disabled={isPublishing} onClick={() => handleOpenChange(true)}>
        <UploadCloudIcon className="size-4" />
        {t("agent:history.publish")}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <DialogHeader>
                <DialogTitle>{t("agent:history.publishDialog.title", { revision })}</DialogTitle>
                <DialogDescription>
                  {t("agent:history.publishDialog.description", { revision })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="revisionName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("agent:history.publishDialog.nameLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder={t("agent:history.publishDialog.namePlaceholder")}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="revisionDesc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("agent:history.publishDialog.descLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          placeholder={t("agent:history.publishDialog.descPlaceholder")}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  {t("actions:cancel")}
                </Button>
                <Button type="submit" disabled={isPublishing}>
                  <UploadCloudIcon className="size-4" />
                  {t("agent:history.publish")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
