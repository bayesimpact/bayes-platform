import { useLingui } from "@lingui/react/macro"
import type { ComponentProps } from "react"
import { type ExtraProps, Streamdown, useIsCodeFenceIncomplete } from "streamdown"
import { ExternalLink } from "./ExternalLink"
import { HighlightedCodeBlock } from "./HighlightedCodeBlock"

export type MarkdownProps = {
  children: string
  /** Whether the text is still streaming: an unfinished block then renders as it will end. */
  isStreaming?: boolean
}

/**
 * An agent's text, rendered from Markdown with Streamdown: tables, lists, links in a new tab, and
 * code blocks highlighted by the shadcn Code Block.
 */
export function Markdown({ children, isStreaming = false }: MarkdownProps) {
  return (
    <Streamdown
      className="flex flex-col gap-3 text-sm leading-relaxed"
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
  if (!("data-block" in props)) {
    return (
      <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]" {...props}>
        {children}
      </code>
    )
  }
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

const MARKDOWN_COMPONENTS = { a: MarkdownLink, code: MarkdownCode, img: MarkdownImage }
