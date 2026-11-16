import { agentValidationSchema, type CreateAgentDto } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { cn } from "@caseai-connect/ui/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusCircleIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { z } from "zod"
import { GridCard } from "@/common/components/grid/Grid"
import { selectAvailableModelsCatalog } from "@/common/features/agents/agents.selectors"
import type { Project } from "@/common/features/projects/projects.models"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { defaultModelOptions } from "@/studio/features/agents/agent-settings/components/tabs/model-tab.helpers"
import { StudioRoutes } from "@/studio/routes/helpers"
import {
  type AgentCreationChoice,
  getDefaultFormValues,
} from "../agent-settings/components/agent-form.shared"
import { createAgent } from "../agents.thunks"

const defaultChoice: AgentCreationChoice = "conversation"
const creationChoices: AgentCreationChoice[] = ["conversation", "extraction", "form"]
const agentNameSchema = agentValidationSchema.pick({ name: true })

type FormValues = z.infer<typeof agentNameSchema>

export function AgentCreatorButton({ project }: { project: Project }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <GridCard className="bg-muted/35">
      <GridCard.Body>
        <GridCard.Title>{t("agent:create.title")}</GridCard.Title>
        <GridCard.Description>{t("agent:create.description")}</GridCard.Description>
        <Button size="lg" className="text-base" onClick={() => setOpen(true)}>
          {t("actions:create")}
          <PlusCircleIcon className="ml-2 size-5" />
        </Button>
        <AgentCreatorDialog project={project} open={open} onOpenChange={setOpen} />
      </GridCard.Body>
    </GridCard>
  )
}

export function SidebarAgentCreatorButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PlusIcon className="size-4 cursor-pointer" onClick={() => setOpen(true)} />
      <AgentCreatorDialog project={project} open={open} onOpenChange={setOpen} />
    </>
  )
}

function AgentCreatorDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [selectedChoice, setSelectedChoice] = useState<AgentCreationChoice>(defaultChoice)
  const form = useForm<FormValues>({
    resolver: zodResolver(agentNameSchema),
    defaultValues: { name: "" },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedChoice(defaultChoice)
      form.reset()
    }
    onOpenChange(nextOpen)
  }

  // The catalog gives the model a new agent starts on; creating waits for it.
  const catalog = useAppSelector(selectAvailableModelsCatalog)

  // The submit stays pending until the agent opens or the creation fails. Enter then a click
  // on the button would otherwise create the agent twice.
  const handleFormSubmit = async (values: FormValues) => {
    if (!catalog) return
    const fields: CreateAgentDto = {
      ...getDefaultFormValues({
        creationChoice: selectedChoice,
        defaultModel: catalog.defaults.agent,
        defaultModelOptions: defaultModelOptions(catalog, catalog.defaults.agent),
      }),
      name: values.name,
      projectAgentSessionCategoryIds: project.agentSessionCategories.map((category) => category.id),
    }

    // `onSuccess` runs once the new agent is listed, after the thunk itself resolved.
    await new Promise<void>((resolve) => {
      dispatch(
        createAgent({
          fields,
          onSuccess: (agent) => {
            resolve()
            handleOpenChange(false)
            navigate(
              StudioRoutes.agentEdit.build({
                organizationId: project.organizationId,
                projectId: project.id,
                agentId: agent.id,
              }),
            )
          },
        }),
      )
        .unwrap()
        .catch(() => resolve())
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agent:create.title")}</DialogTitle>
          <DialogDescription>{t("agent:create.typeDialog.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4 pt-2" onSubmit={form.handleSubmit(handleFormSubmit)}>
            <Field>
              <FieldLabel>{t("agent:create.typeDialog.title")}</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {creationChoices.map((creationChoice) => (
                  <button
                    key={creationChoice}
                    type="button"
                    className={cn(
                      "border rounded-md px-3 py-2 text-sm text-center",
                      selectedChoice === creationChoice ? "border-primary" : "border-muted",
                    )}
                    onClick={() => setSelectedChoice(creationChoice)}
                  >
                    {t(`agent:create.typeDialog.${creationChoice}`)}
                  </button>
                ))}
              </div>
            </Field>

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

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting || catalog === null}
            >
              {t("actions:create")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
