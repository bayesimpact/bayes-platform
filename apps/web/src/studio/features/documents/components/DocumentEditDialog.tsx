import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { XIcon } from "lucide-react"
import { useReducer } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import {
  getTagNameById,
  useDocumentTags,
} from "@/studio/features/document-tags/document-tags.helpers"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import type { Document } from "@/studio/features/documents/documents.models"
import { updateDocument } from "@/studio/features/documents/documents.thunks"

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
      return {
        ...state,
        tagIds: state.tagIds.filter((id) => id !== action.tagId),
      }
  }
}

export function DocumentEditForm({
  document,
  onSuccess,
}: {
  document: Document
  onSuccess: () => void
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { documentTags } = useDocumentTags()

  const [editorState, dispatchEditor] = useReducer(editorReducer, {
    title: document.title,
    tagIds: document.tagIds,
  })

  const handleSave = () => {
    const originalTagIds = document.tagIds
    const tagsToAdd = editorState.tagIds.filter((tagId) => !originalTagIds.includes(tagId))
    const tagsToRemove = originalTagIds.filter((tagId) => !editorState.tagIds.includes(tagId))
    dispatch(
      updateDocument({
        documentId: document.id,
        fields: { title: editorState.title, tagsToAdd, tagsToRemove },
        onSuccess,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="doc-title">{t("document:props.title")}</FieldLabel>
              <Input
                id="doc-title"
                value={editorState.title}
                onChange={(event) =>
                  dispatchEditor({
                    type: "SET_TITLE",
                    title: event.target.value,
                  })
                }
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <FieldLabel>{t("document:props.tags")}</FieldLabel>
        <div className="flex flex-wrap gap-2 items-center">
          {editorState.tagIds.map((tagId) => (
            <Badge key={tagId} variant="secondary" className="gap-1">
              {getTagNameById(documentTags, tagId)}
              <button
                type="button"
                onClick={() => dispatchEditor({ type: "REMOVE_TAG", tagId })}
                className="opacity-60 hover:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <DocumentTagPicker
            documentTags={documentTags}
            attachedTagIds={editorState.tagIds}
            onAdd={(tagId) => dispatchEditor({ type: "ADD_TAG", tagId })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>{t("actions:update")}</Button>
      </div>
    </div>
  )
}

export function DocumentMetaField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  )
}
