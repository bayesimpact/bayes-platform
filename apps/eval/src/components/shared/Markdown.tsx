import { useLingui } from "@lingui/react/macro"
import { type ComponentProps, createContext, use, useId } from "react"
import {
  defaultComponents,
  type ExtraProps,
  Streamdown,
  useIsCodeFenceIncomplete,
} from "streamdown"
import { Checkbox } from "@/components/ui/checkbox"
import { withTaskStates } from "@/lib/task-list"
import { ExternalLink } from "./ExternalLink"
import { HighlightedCodeBlock } from "./HighlightedCodeBlock"
import { InlineCode } from "./InlineCode"

export type MarkdownProps = {
  children: string
  /** Whether the text is still streaming: an unfinished block then renders as it will end. */
  isStreaming?: boolean
  /** The tasks the person ticked or unticked, by their place from 1, over what the text says. */
  taskStates?: ReadonlyMap<number, boolean>
  /** Called as the person ticks a task; without it, the tasks show as the text says, read only. */
  onTaskToggle?: (task: { item: number; isChecked: boolean; text: string }) => void
}

/** The attribute of the element around the text, whose tasks are counted to name the one ticked. */
const TASK_LIST_ATTRIBUTE = "data-task-list"

/** Ticks the task of that item of the list, or `null` when the tasks are read only. */
const TaskToggleContext = createContext<((item: Element, isChecked: boolean) => void) | null>(null)

/**
 * An agent's text, rendered from Markdown with Streamdown: tables, lists, task lists as
 * checkboxes, links in a new tab, and code blocks highlighted by the shadcn Code Block.
 */
export function Markdown({
  children,
  isStreaming = false,
  taskStates,
  onTaskToggle,
}: MarkdownProps) {
  // A task is named by its place among the text's tasks, as the text counts them too.
  const toggleTask = onTaskToggle
    ? (item: Element, isChecked: boolean) => {
        const tasks = Array.from(
          item.closest(`[${TASK_LIST_ATTRIBUTE}]`)?.querySelectorAll("li[data-task-item]") ?? [],
        )
        onTaskToggle({
          item: tasks.indexOf(item) + 1,
          isChecked,
          text: (item.textContent ?? "").trim(),
        })
      }
    : null
  return (
    <TaskToggleContext value={toggleTask}>
      <div className="contents" {...{ [TASK_LIST_ATTRIBUTE]: "" }}>
        <MarkdownText isStreaming={isStreaming}>
          {taskStates ? withTaskStates(children, taskStates) : children}
        </MarkdownText>
      </div>
    </TaskToggleContext>
  )
}

type MarkdownTextProps = {
  children: string
  isStreaming: boolean
}

function MarkdownText({ children, isStreaming }: MarkdownTextProps) {
  return (
    <Streamdown
      // One spacing between blocks: Streamdown's own `space-y-4`, which this one replaces, would
      // add up with a flex gap.
      className="space-y-3 text-message leading-relaxed"
      controls={false}
      // Links open in a new tab without Streamdown's confirmation, whose text is not translated.
      linkSafety={{ enabled: false }}
      components={MARKDOWN_COMPONENTS}
      isAnimating={isStreaming}
    >
      {children}
    </Streamdown>
  )
}

function MarkdownLink({ node, children, href, ...props }: ComponentProps<"a"> & ExtraProps) {
  return (
    <ExternalLink
      {...props}
      href={href}
      className="inline-flex items-baseline gap-0.5 font-medium text-primary underline underline-offset-4"
    >
      {children}
    </ExternalLink>
  )
}

/**
 * An image of the reply, shown as a link the person opens. An image would load on its own, so a
 * reply steered by a document or a web page could send what it knows to any server in its URL.
 */
function MarkdownImage({ src, alt }: ComponentProps<"img"> & ExtraProps) {
  const { t } = useLingui()
  if (typeof src !== "string" || src === "") return null
  const label = alt || t({ message: "Image", comment: "An image in a reply, which names none" })
  return (
    <ExternalLink
      href={src}
      className="inline-flex items-baseline gap-0.5 font-medium text-primary underline underline-offset-4"
    >
      {label}
    </ExternalLink>
  )
}

function MarkdownCode({
  node,
  className,
  children,
  ...props
}: ComponentProps<"code"> & ExtraProps) {
  // Streamdown marks fenced code with data-block. Everything else is inline.
  if (!("data-block" in props)) return <InlineCode>{children}</InlineCode>
  return (
    <MarkdownCodeBlock
      code={typeof children === "string" ? children : ""}
      language={/language-(\S+)/.exec(className ?? "")?.[1] ?? ""}
    />
  )
}

type MarkdownCodeBlockProps = {
  code: string
  language: string
}

function MarkdownCodeBlock({ code, language }: MarkdownCodeBlockProps) {
  // True while the closing fence has not arrived yet.
  const isIncomplete = useIsCodeFenceIncomplete()
  return <HighlightedCodeBlock code={code} language={language} isIncomplete={isIncomplete} />
}

/**
 * An item of a list, as Streamdown draws it, unless it is a task: then a checkbox stands in place
 * of its bullet, named by the item's text, checked as the text says. The person ticks it when the
 * text lets them, and the text then comes back with the task's new state.
 */
function MarkdownListItem({
  node,
  className,
  children,
  ...props
}: ComponentProps<"li"> & ExtraProps) {
  const textId = useId()
  const toggleTask = use(TaskToggleContext)
  const DefaultListItem = defaultComponents.li
  if (!className?.includes("task-list-item") || !node) {
    return (
      <DefaultListItem node={node} className={className} {...props}>
        {children}
      </DefaultListItem>
    )
  }
  const isChecked = node.children.some(
    (child) =>
      child.type === "element" && child.tagName === "input" && child.properties.checked === true,
  )
  return (
    <li {...props} data-task-item="" className="flex list-none items-start gap-2 py-1">
      <Checkbox
        checked={isChecked}
        readOnly={toggleTask === null}
        onCheckedChange={(checked, details) => {
          const item =
            details.event.target instanceof Element ? details.event.target.closest("li") : null
          if (item) toggleTask?.(item, checked)
        }}
        aria-labelledby={textId}
        className="mt-1"
      />
      <div id={textId}>{children}</div>
    </li>
  )
}

/** The checkbox of a task, which its item draws: Markdown's own would be a bare input. */
function MarkdownInput({ node, ...props }: ComponentProps<"input"> & ExtraProps) {
  return props.type === "checkbox" ? null : <input {...props} />
}

const MARKDOWN_COMPONENTS = {
  a: MarkdownLink,
  code: MarkdownCode,
  img: MarkdownImage,
  input: MarkdownInput,
  li: MarkdownListItem,
}
