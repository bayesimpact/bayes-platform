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

type FormValues = z.infer<typeof duplicateAgentSchema>

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

  // The name is the only field, and a name under the minimum length is the only way it fails.
  const resolver = useMemo(
    () =>
      zodResolver(duplicateAgentSchema, {
        error: () => t("agent:props.validation.nameMinLength"),
      }),
    [t],
  )
  const form = useForm<FormValues>({
    resolver,
    defaultValues: { name: t("agent:duplicate.defaultName", { name: agent.name }) },
  })

  // The form stays submitting until the copy's editor opens, which happens once the agent list
  // and the abilities know the copy, or until the duplication fails and its error shows.
  const handleSubmit = form.handleSubmit(
    ({ name }) =>
      new Promise<void>((resolve) => {
        onDuplicatingChange(true)
        const finish = () => {
          onDuplicatingChange(false)
          resolve()
        }
        dispatch(
          duplicateAgent({
            agentId: agent.id,
            fields: { name },
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

        <div className="py-4">
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
