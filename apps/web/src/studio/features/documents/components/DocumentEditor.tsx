import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
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
import { Field, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { PencilIcon, XIcon } from "lucide-react"
import { useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import {
  getTagNameById,
  useDocumentTags,
} from "@/studio/features/document-tags/document-tags.helpers"
import type { Document } from "@/studio/features/documents/documents.models"
import { updateDocument } from "@/studio/features/documents/documents.thunks"
import { DocumentTagPicker } from "./DocumentTagPicker"

type EditorAction =
  | { type: "SET_TITLE"; title: string }
  | { type: "ADD_TAG"; tagId: string }
  | { type: "REMOVE_TAG"; tagId: string }

type EditorState = { title: string; tagIds: string[] }

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_TITLE":
      return { ...state, title: action.title }
    case "ADD_TAG":
      return { ...state, tagIds: [...state.tagIds, action.tagId] }
    case "REMOVE_TAG":
      return { ...state, tagIds: state.tagIds.filter((id) => id !== action.tagId) }
  }
}

export function DocumentEditor({ document }: { document: Document }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("document:update.title", { documentTitle: document.title })}</DialogTitle>
        </DialogHeader>
        {open && <EditorForm document={document} onSuccess={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditorForm({ document, onSuccess }: { document: Document; onSuccess: () => void }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { documentTags } = useDocumentTags()
  const [pendingPublicTagId, setPendingPublicTagId] = useState<string | null>(null)

  const [editorState, dispatchEditor] = useReducer(editorReducer, {
    title: document.title,
    tagIds: document.tagIds,
  })

  const handleAddTag = (tagId: string) => {
    const tag = documentTags.find((t) => t.id === tagId)
    if (tag?.name === PUBLIC_DOCUMENTS_TAG_NAME) {
      setPendingPublicTagId(tagId)
    } else {
      dispatchEditor({ type: "ADD_TAG", tagId })
    }
  }

  const handleConfirmPublicTag = () => {
    if (pendingPublicTagId) {
      dispatchEditor({ type: "ADD_TAG", tagId: pendingPublicTagId })
    }
    setPendingPublicTagId(null)
  }

  const handleSave = () => {
    const originalTagIds = document.tagIds
    const tagsToAdd = editorState.tagIds.filter((id) => !originalTagIds.includes(id))
    const tagsToRemove = originalTagIds.filter((id) => !editorState.tagIds.includes(id))
    dispatch(
      updateDocument({
        documentId: document.id,
        fields: { title: editorState.title, tagsToAdd, tagsToRemove },
        onSuccess,
      }),
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <FieldGroup>
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="doc-title">{t("document:props.title")}</FieldLabel>
                <Input
                  id="doc-title"
                  value={editorState.title}
                  onChange={(e) => dispatchEditor({ type: "SET_TITLE", title: e.target.value })}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>

        <div className="flex flex-col gap-2">
          <FieldLabel>{t("document:props.tags")}</FieldLabel>
          <div className="flex flex-wrap gap-2 items-center">
            {editorState.tagIds.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1">
                {getTagNameById(documentTags, id)}
                <button
                  type="button"
                  onClick={() => dispatchEditor({ type: "REMOVE_TAG", tagId: id })}
                  className="opacity-60 hover:opacity-100"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
            <DocumentTagPicker
              documentTags={documentTags}
              attachedTagIds={editorState.tagIds}
              onAdd={handleAddTag}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave}>{t("actions:update")}</Button>
        </div>
      </div>

      <Dialog
        open={pendingPublicTagId !== null}
        onOpenChange={(open) => !open && setPendingPublicTagId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("document:publicTag.disclaimer.title")}</DialogTitle>
            <DialogDescription>{t("document:publicTag.disclaimer.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPublicTagId(null)}>
              {t("actions:cancel")}
            </Button>
            <Button onClick={handleConfirmPublicTag}>
              {t("document:publicTag.disclaimer.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
