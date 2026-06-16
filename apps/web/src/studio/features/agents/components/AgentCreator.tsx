import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { ScrollArea } from "@caseai-connect/ui/shad/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@caseai-connect/ui/shad/sheet"
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
import type { AgentFormData } from "./agent-form.shared"
import { BaseAgentForm } from "./BaseAgentForm"

const defaultStep = "typeSelection"
const defaultType = "conversation"

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
        <AgentCreator project={project} open={open} onOpenChange={setOpen} />
      </GridCard.Body>
    </GridCard>
  )
}

export function SidebarAgentCreatorButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PlusIcon className="size-4 cursor-pointer" onClick={() => setOpen(true)} />
      <AgentCreator project={project} open={open} onOpenChange={setOpen} />
    </>
  )
}

function AgentCreator({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [step, setStep] = useState<"typeSelection" | "agentCreation">(defaultStep)
  const [selectedType, setSelectedType] = useState<Agent["type"]>(defaultType)

  const reset = () => {
    onOpenChange(false)
    setStep(defaultStep)
    setSelectedType(defaultType)
  }

  const handleNextStep = () => setStep("agentCreation")

  const handleOpenChange = (open: boolean) => {
    if (!open) reset()
  }

  return (
    <>
      {/* // First step */}
      <TypeSelection
        open={open && step === "typeSelection"}
        selectedType={selectedType}
        onSelectType={setSelectedType}
        onOpenChange={handleOpenChange}
        onComplete={handleNextStep}
      />

      {/* // Second step */}
      <AgentCreation
        project={project}
        open={open && step === "agentCreation"}
        onOpenChange={handleOpenChange}
        selectedType={selectedType}
        onSuccess={reset}
      />
    </>
  )
}

function TypeSelection({
  open,
  onOpenChange,
  onComplete,
  onSelectType,
  selectedType,
}: {
  onSelectType: (agentType: Agent["type"]) => void
  selectedType: Agent["type"]
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agent:create.typeDialog.title")}</DialogTitle>
          <DialogDescription>{t("agent:create.typeDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "border rounded-md px-3 py-2 text-sm text-left",
                selectedType === "conversation" ? "border-primary" : "border-muted",
              )}
              onClick={() => onSelectType("conversation")}
            >
              {t("agent:create.typeDialog.conversation")}
            </button>
            <button
              type="button"
              className={cn(
                "border rounded-md px-3 py-2 text-sm text-left",
                selectedType === "extraction" ? "border-primary" : "border-muted",
              )}
              onClick={() => onSelectType("extraction")}
            >
              {t("agent:create.typeDialog.extraction")}
            </button>
            <button
              type="button"
              className={cn(
                "border rounded-md px-3 py-2 text-sm text-left",
                selectedType === "form" ? "border-primary" : "border-muted",
              )}
              onClick={() => onSelectType("form")}
            >
              {t("agent:create.typeDialog.form")}
            </button>
          </div>

          <Button type="button" onClick={onComplete} className="w-full">
            {t("actions:confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AgentCreation({
  project,
  open,
  onOpenChange,
  selectedType,
  onSuccess,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedType: Agent["type"]
  onSuccess: () => void
}) {
  const { t } = useTranslation("agent", { keyPrefix: "create" })
  const navigate = useNavigate()

  const handleSuccess = (agent: Agent) => {
    const path = StudioRoutes.agent.build({
      organizationId: project.organizationId,
      projectId: project.id,
      agentId: agent.id,
    })
    navigate(path)
    onSuccess()
  }

  const sheetTitle = t(`${selectedType}Dialog.title`)
  const sheetDescription = t(`${selectedType}Dialog.description`, { projectName: project.name })

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-dvh">
        <ScrollArea className="h-full">
          <SheetHeader>
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>{sheetDescription}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CreateForm agentType={selectedType} onSuccess={handleSuccess} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function CreateForm({
  agentType,
  onSuccess,
}: {
  agentType: Agent["type"]
  onSuccess: (agent: Agent) => void
}) {
  const dispatch = useAppDispatch()

  const handleCreate = async (fields: AgentFormData) => {
    await dispatch(
      createAgent({
        fields: {
          name: fields.name,
          defaultPrompt: fields.defaultPrompt,
          greetingMessage: fields.greetingMessage,
          documentsRagMode: fields.documentsRagMode,
          model: fields.model,
          temperature: fields.temperature,
          locale: fields.locale,
          type: agentType,
          outputJsonSchema: fields.outputJsonSchema,
          tagsToAdd: fields.tagsToAdd,
          projectAgentSessionCategoryIds: fields.projectAgentSessionCategoryIds,
          resourceLibraryIds: fields.resourceLibraryIds,
        },
        onSuccess,
      }),
    )
  }

  return <BaseAgentForm agentType={agentType} onSubmit={handleCreate} />
}
