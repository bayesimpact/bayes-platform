import { ExternalLinkIcon } from "lucide-react"
import Markdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { cn } from "../lib/cn"

export type MarkdownProps = {
  content: string
  end?: React.ReactNode
}

export function MarkdownWrapper({ content, end }: MarkdownProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        h1: ({ children }) => (
          <h1 className={cn("mb-2 mt-4 text-3xl font-bold first:mt-0")}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className={cn("mb-2 mt-4 text-2xl font-semibold first:mt-0")}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className={cn("mb-2 mt-3 text-xl font-semibold first:mt-0")}>{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className={cn("mb-2 mt-3 text-lg font-medium first:mt-0")}>{children}</h4>
        ),
        h5: ({ children }) => (
          <h5 className={cn("mb-2 mt-2 text-base font-medium first:mt-0")}>{children}</h5>
        ),
        h6: ({ children }) => (
          <h6 className={cn("mb-2 mt-2 text-sm font-medium first:mt-0")}>{children}</h6>
        ),
        p: ({ children }) => (
          <p className={cn("mb-2 leading-relaxed last:mb-0")}>
            {children} {end}
          </p>
        ),
        ul: ({ children }) => (
          <ul className={cn("list-disc pb-4 pl-6 last:mb-0 [&_ol]:mb-0 [&_ul]:mb-0")}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className={cn("list-decimal pb-4 pl-6 last:mb-0 [&_ol]:mb-0 [&_ul]:mb-0")}>
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className={cn("mb-px leading-relaxed [&>p:last-child]:mb-0 [&>p]:mb-0")}>
            {children}
          </li>
        ),
        pre: ({ children }) => (
          <pre className={cn("mb-4 overflow-x-auto rounded-lg bg-gray-800 p-4 text-sm text-white")}>
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className={cn(
              "mb-4 border-l-4 border-blue-200 bg-blue-50 py-2 pl-4 italic text-blue-700",
            )}
          >
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            className={cn(
              "inline-flex w-fit items-center gap-1 text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-800 hover:no-underline",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            {children} <ExternalLinkIcon className="size-3.5" />
          </a>
        ),
        hr: () => <hr className="my-6 border-t border-gray-200" />,
        strong: ({ children }) => <strong className={cn("font-semibold")}>{children}</strong>,
        em: ({ children }) => <em className={cn("italic")}>{children}</em>,
      }}
    >
      {content}
    </Markdown>
  )
}
