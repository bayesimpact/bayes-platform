import { duplicateAgentSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import { RadioGroup, RadioGroupItem } from "@caseai-connect/ui/shad/radio-group"
import { zodResolver } from "@hookform/resolvers/zod"
import { CopyIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { z } from "zod"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { duplicateAgent } from "../agents.thunks"

/** Duplicate button of an agent: asks for the copy's name, then opens the copy's editor. */
export function AgentDuplicatorWithTrigger({
  organizationId,
  agent,
}: {
  organizationId: string
  agent: Agent
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // While the copy is made, the dialog cannot be closed: a second copy could start, and the
  // first copy's editor would still open later.
  const [duplicating, setDuplicating] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || !duplicating) setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CopyIcon />
          {t("actions:duplicate")}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!duplicating}>
        <DuplicateForm
          organizationId={organizationId}
          agent={agent}
          onDuplicatingChange={setDuplicating}
          onDuplicated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

type FormInput = z.input<typeof duplicateAgentSchema>
type FormValues = z.output<typeof duplicateAgentSchema>

function DuplicateForm({
  organizationId,
  agent,
  onDuplicatingChange,
  onDuplicated,
}: {
  organizationId: string
  agent: Agent
  onDuplicatingChange: (duplicating: boolean) => void
  onDuplicated: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // The source is a choice between two values: a name under the minimum length is the only way
  // the form fails.
  const resolver = useMemo(
    () =>
      zodResolver(duplicateAgentSchema, {
        error: () => t("agent:props.validation.nameMinLength"),
      }),
    [t],
  )
  // With both a published revision and a draft, the person picks the one the copy starts from.
  // The draft comes first: it is what the editor shows.
  const publishedRevision = agent.currentRevision?.number
  const draftRevision = agent.draftRevision?.number
  const hasSourceChoice = publishedRevision !== undefined && draftRevision !== undefined
  const form = useForm<FormInput, unknown, FormValues>({
    resolver,
    defaultValues: {
      name: t("agent:duplicate.defaultName", { name: agent.name }),
      source: hasSourceChoice ? "draft" : "published",
    },
  })

  // The form stays submitting until the copy's editor opens, which happens once the agent list
  // and the abilities know the copy, or until the duplication fails and its error shows.
  const handleSubmit = form.handleSubmit(
    ({ name, source }) =>
      new Promise<void>((resolve) => {
        onDuplicatingChange(true)
        const finish = () => {
          onDuplicatingChange(false)
          resolve()
        }
        dispatch(
          duplicateAgent({
            agentId: agent.id,
            fields: { name, source },
            onSuccess: (copy) => {
              finish()
              onDuplicated()
              // The editor of an extraction agent is its agent page.
              const editorRoute =
                copy.type === "extraction" ? StudioRoutes.agent : StudioRoutes.agentEdit
              navigate(
                editorRoute.build({
                  organizationId,
                  projectId: copy.projectId,
                  agentId: copy.id,
                }),
              )
            },
          }),
        )
          .unwrap()
          .catch(finish)
      }),
  )

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{t("agent:duplicate.title")}</DialogTitle>
          <DialogDescription>
            {t("agent:duplicate.description", { name: agent.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agent:props.name")}</FormLabel>
                <FormControl>
                  <Input autoFocus placeholder={t("agent:props.placeholders.name")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {hasSourceChoice && (
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("agent:duplicate.source.label")}</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange}>
                      <DuplicationSourceOption
                        value="draft"
                        label={t("agent:duplicate.source.draft", { number: draftRevision })}
                        description={t("agent:duplicate.source.draftDescription")}
                      />
                      <DuplicationSourceOption
                        value="published"
                        label={t("agent:duplicate.source.published", { number: publishedRevision })}
                        description={t("agent:duplicate.source.publishedDescription")}
                      />
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <CopyIcon />
            {t("actions:duplicate")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function DuplicationSourceOption({
  value,
  label,
  description,
}: {
  value: FormValues["source"]
  label: string
  description: string
}) {
  const id = `duplicate-source-${value}`
  return (
    <div className="flex items-start gap-2">
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <Label htmlFor={id} className="flex cursor-pointer flex-col items-start gap-1 font-normal">
        <span>{label}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </Label>
    </div>
  )
}
