"use client"

import { Button } from "@caseai-connect/ui/shad/button"
import { ScrollArea } from "@caseai-connect/ui/shad/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { PenLineIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { useDocumentTags } from "@/studio/features/document-tags/document-tags.helpers"
import { updateAgent } from "../agents.thunks"
import type { AgentFormData } from "./agent-form.shared"
import { BaseAgentForm } from "./BaseAgentForm"

export function AgentEditorWithTrigger({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  const handleSuccess = () => {
    setOpen(false)
  }

  if (!agent) return null
  return (
    <Sheet modal open={open} onOpenChange={(open: boolean) => setOpen(open)}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <PenLineIcon />
          {t("actions:edit")}
        </Button>
      </SheetTrigger>

      <Content agent={agent} onSuccess={handleSuccess} />
    </Sheet>
  )
}

export function AgentEditorWithoutTrigger({
  agent,
  onClose,
}: {
  agent: Agent | null
  onClose: () => void
}) {
  const handleSuccess = () => {
    onClose()
  }

  if (!agent) return null
  return (
    <Sheet modal open={!!agent} onOpenChange={(open: boolean) => !open && onClose()}>
      <Content agent={agent} onSuccess={handleSuccess} />
    </Sheet>
  )
}

function Content({ agent, onSuccess }: { agent: Agent; onSuccess: () => void }) {
  const { t } = useTranslation("agent", { keyPrefix: "update" })
  const sheetTitle = t(`${agent.type}.title`)
  const sheetDescription = t(`${agent.type}.description`)

  return (
    <SheetContent side="bottom" className="h-dvh">
      <ScrollArea className="h-full">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <UpdateForm agent={agent} onSuccess={onSuccess} />
        </div>
      </ScrollArea>
    </SheetContent>
  )
}

export function AgentEditor({ agent, className }: { agent: Agent; className?: string }) {
  return (
    <div className={className}>
      <UpdateForm agent={agent} />
    </div>
  )
}

function UpdateForm({ agent, onSuccess }: { agent: Agent; onSuccess?: () => void }) {
  const dispatch = useAppDispatch()
  const currentProject = useAppSelector(selectCurrentProjectData)
  const { documentTags } = useDocumentTags()
  const projectAgentCategories = ADS.isFulfilled(currentProject)
    ? currentProject.value.agentCategories
    : []

  const handleSubmit = (fields: AgentFormData) => {
    if (!("documentTagIds" in fields)) {
      throw new Error("Missing documentTagIds in fields")
    }

    const originalTagIds = agent.documentTagIds
    dispatch(
      updateAgent({
        agentId: agent.id,
        fields: {
          name: fields.name,
          defaultPrompt: fields.defaultPrompt,
          greetingMessage: fields.greetingMessage,
          documentsRagMode: fields.documentsRagMode,
          model: fields.model,
          temperature: fields.temperature,
          locale: fields.locale,
          outputJsonSchema: fields.outputJsonSchema,
          documentTagIds: fields.documentTagIds,
          tagsToAdd: fields.documentTagIds.filter((id) => !originalTagIds.includes(id)),
          tagsToRemove: originalTagIds.filter((id) => !fields.documentTagIds.includes(id)),
          projectAgentCategoryIds: fields.projectAgentCategoryIds,
        },
      }),
    )
    onSuccess?.()
  }

  return (
    <BaseAgentForm
      agentType={agent.type}
      editableAgent={agent}
      onSubmit={handleSubmit}
      documentTags={documentTags}
      projectAgentCategories={projectAgentCategories}
    />
  )
}
