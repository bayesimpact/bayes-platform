import { AgentLocale, type CreateAgentDto } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { cn } from "@caseai-connect/ui/utils"
import { PlusCircleIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridCard } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import type { Project } from "@/common/features/projects/projects.models"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { createAgent } from "../agents.thunks"
import { getDefaultFormValues } from "./agent-form.shared"

const defaultType: Agent["type"] = "conversation"
const agentTypes: Agent["type"][] = ["conversation", "extraction"]
const minNameLength = 3

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
  const { t, i18n } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState<Agent["type"]>(defaultType)
  const [name, setName] = useState("")

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedType(defaultType)
      setName("")
    }
    onOpenChange(nextOpen)
  }

  const canCreate = name.trim().length >= minNameLength

  const handleCreate = () => {
    const language = i18n.language.startsWith("fr") ? AgentLocale.FR : AgentLocale.EN
    const fields: CreateAgentDto = {
      ...getDefaultFormValues({ agentType: selectedType, language }),
      type: selectedType,
      name: name.trim(),
      projectAgentSessionCategoryIds: project.agentSessionCategories.map((category) => category.id),
    }

    dispatch(
      createAgent({
        fields,
        onSuccess: (agent) => {
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
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agent:create.title")}</DialogTitle>
          <DialogDescription>{t("agent:create.typeDialog.description")}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (canCreate) handleCreate()
          }}
        >
          <Field>
            <FieldLabel>{t("agent:create.typeDialog.title")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {agentTypes.map((agentType) => (
                <button
                  key={agentType}
                  type="button"
                  className={cn(
                    "border rounded-md px-3 py-2 text-sm text-center",
                    selectedType === agentType ? "border-primary" : "border-muted",
                  )}
                  onClick={() => setSelectedType(agentType)}
                >
                  {t(`agent:create.typeDialog.${agentType}`)}
                </button>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="agent-name">{t("agent:props.name")}</FieldLabel>
            <Input
              id="agent-name"
              autoFocus
              placeholder={t("agent:props.placeholders.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={!canCreate}>
            {t("actions:create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
