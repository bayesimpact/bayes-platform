import { agentSettingsCreateSchema } from "@bayes-platform/api-contracts"
import { Button } from "@bayes-platform/ui/shad/button"
import { Checkbox } from "@bayes-platform/ui/shad/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bayes-platform/ui/shad/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bayes-platform/ui/shad/form"
import { Input } from "@bayes-platform/ui/shad/input"
import { Textarea } from "@bayes-platform/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { SaveIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { createAgentSettings } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"

/**
 * Saves the agent's draft revision as a version. The editor keeps its changes in a draft
 * revision; saving freezes it. It goes in production only when asked, or when it is the agent's
 * first saved revision. Disabled while there is no draft to save.
 */
export function AgentSettingsCreateButton({
  agentSettings,
  buttonProps,
}: {
  agentSettings: AgentSettings
  buttonProps?: React.ComponentProps<typeof Button>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const disabledTitle = agentSettings.isDraft ? undefined : t("agentSettings:create.noDraft")

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          disabled={!agentSettings.isDraft}
          title={disabledTitle}
          size="lg"
          variant="default"
          className="text-base"
          {...buttonProps}
        >
          {t("agentSettings:create.button")}
          <SaveIcon className="ml-2 size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <PublishForm agentSettings={agentSettings} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

type FormValues = z.infer<typeof agentSettingsCreateSchema>

function PublishForm({
  agentSettings,
  onSuccess,
}: {
  agentSettings: AgentSettings
  onSuccess: () => void
}) {
  const { t } = useTranslation("agentSettings")
  const dispatch = useAppDispatch()
  // Nothing in production yet: the API puts the first saved revision there whatever is asked.
  const productionRevision = useValue(selectCurrentAgentData).currentRevision?.number
  const isFirstVersion = productionRevision === undefined

  const form = useForm<FormValues>({
    resolver: zodResolver(agentSettingsCreateSchema),
    defaultValues: {
      revisionName: agentSettings.name ?? "",
      revisionDesc: agentSettings.description ?? "",
      setAsProduction: isFirstVersion,
    },
  })

  const handleFormSubmit = (values: FormValues) => {
    dispatch(
      createAgentSettings({
        revision: agentSettings.revision,
        // Both fields are optional: send undefined rather than an empty string so the
        // published version keeps no name/description at all.
        revisionName: values.revisionName?.trim() || undefined,
        revisionDesc: values.revisionDesc?.trim() || undefined,
        setAsProduction: isFirstVersion || !!values.setAsProduction,
        onSuccess,
      }),
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)}>
        <DialogHeader>
          <DialogTitle>
            {t("create.dialog.title", { revision: agentSettings.revision })}
          </DialogTitle>
          <DialogDescription>
            {t("create.dialog.description", { revision: agentSettings.revision })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <FormField
            control={form.control}
            name="revisionName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("create.props.revisionName")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("create.props.placeholders.revisionName")} {...field} />
                </FormControl>
                <FormDescription>{t("create.optional")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="revisionDesc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("create.props.revisionDesc")}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={t("create.props.placeholders.revisionDesc")}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t("create.optional")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="setAsProduction"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
                <FormControl>
                  <Checkbox
                    checked={isFirstVersion || !!field.value}
                    disabled={isFirstVersion}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                </FormControl>
                <div className="flex flex-col gap-1">
                  <FormLabel>{t("create.props.setAsProduction")}</FormLabel>
                  <FormDescription>
                    {isFirstVersion
                      ? t("create.firstVersionProduction")
                      : t("create.setAsProductionDescription", { current: productionRevision })}
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("create.dialog.submit")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
