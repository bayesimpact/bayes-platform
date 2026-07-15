import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

export type OrderedQuestion = {
  key: string
  description?: string
}

type Props = {
  questions: OrderedQuestion[]
  onReorder: (orderedKeys: string[]) => void
  disabled?: boolean
}

/**
 * Returns a new key list with `activeKey` moved to the position currently held by `overKey`.
 * Returns the list unchanged when either key is missing or they are identical.
 */
export function reorderKeys(keys: string[], activeKey: string, overKey: string): string[] {
  if (activeKey === overKey) return keys
  const from = keys.indexOf(activeKey)
  const to = keys.indexOf(overKey)
  if (from === -1 || to === -1) return keys
  const next = [...keys]
  const [removed] = next.splice(from, 1)
  if (removed === undefined) return keys
  next.splice(to, 0, removed)
  return next
}

function SortableQuestion({
  question,
  index,
  disabled,
}: {
  question: OrderedQuestion
  index: number
  disabled: boolean
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.key,
    disabled,
  })

  return (
    <li
      ref={setNodeRef}
      data-testid={`question-order-${index}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border bg-background p-2 ${
        isDragging ? "z-10 opacity-80 shadow-md" : ""
      }`}
    >
      <button
        type="button"
        aria-label={t("agent:props.questionOrder.dragHandle")}
        disabled={disabled}
        className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <span className="shrink-0 text-muted-foreground text-sm tabular-nums">{index + 1}.</span>

      <div className="min-w-0">
        <p className="text-sm font-medium">{question.key}</p>
        {question.description && (
          <p className="text-muted-foreground text-xs">{question.description}</p>
        )}
      </div>
    </li>
  )
}

export function QuestionOrderEditor({ questions, onReorder, disabled = false }: Props) {
  const { t } = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorder(
      reorderKeys(
        questions.map((question) => question.key),
        String(active.id),
        String(over.id),
      ),
    )
  }

  if (questions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">{t("agent:props.questionOrder.empty")}</p>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={questions.map((question) => question.key)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="flex flex-col gap-2">
          {questions.map((question, index) => (
            <SortableQuestion
              key={question.key}
              question={question}
              index={index}
              disabled={disabled}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
