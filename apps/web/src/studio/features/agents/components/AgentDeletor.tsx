"use client"

import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAppDispatch } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { deleteAgent } from "../agents.thunks"

export function AgentDeletorWithTrigger({
  organizationId,
  agent,
}: {
  organizationId: string
  agent: Agent
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const path = StudioRoutes.project.build({ organizationId, projectId: agent.projectId })

  const handleSuccess = () => {
    navigate(path, { replace: true })
    setOpen(false)
  }

  const handleClose = () => {
    setOpen(false)
  }

  if (!agent) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Trash2Icon />
        </Button>
      </DialogTrigger>
      <Content agent={agent} onSuccess={handleSuccess} onClose={handleClose} />
    </Dialog>
  )
}

export function AgentDeletorWithoutTrigger({
  organizationId,
  projectId,
  agent,
  onClose,
}: {
  organizationId: string
  projectId: string
  agent: Agent | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const path = StudioRoutes.project.build({ organizationId, projectId })
  const handleSuccess = () => {
    navigate(path, { replace: true })
    onClose()
  }

  if (!agent) return null

  return (
    <Dialog open={!!agent} onOpenChange={(open: boolean) => !open && onClose()}>
      <Content agent={agent} onSuccess={handleSuccess} onClose={onClose} />
    </Dialog>
  )
}

function Content({
  agent,
  onSuccess,
  onClose,
}: {
  agent: Agent
  onSuccess: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const handleDelete = () => {
    dispatch(deleteAgent({ agentId: agent.id }))
    onSuccess()
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("agent:delete.title")}</DialogTitle>
        <DialogDescription>{t("agent:delete.description", { name: agent.name })}</DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          {t("actions:cancel")}
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          {t("actions:delete")}
        </Button>
      </div>
    </DialogContent>
  )
}
