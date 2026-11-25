import { cn } from "@bayes-platform/ui/utils"
import { ExternalLinkIcon } from "lucide-react"
import Markdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

export type MarkdownProps = {
  content: string
  theme?: "light" | "dark"
  end?: React.ReactNode
}

// Built once at module load. A streamed answer re-renders this component on every token, and these
// literals used to be rebuilt on each one: an array plus an object carrying ~25 fresh closures.
// react-markdown re-runs its parser regardless (`Markdown` calls `createProcessor` unconditionally),
// so this only removes the allocation churn, not the parsing work.
const REMARK_PLUGINS = [remarkGfm, remarkBreaks]

/** Renderers that look the same in both themes. */
const BASE_COMPONENTS = {
  // Headings
  h1: ({ children }) => (
    <h1 className={cn("mt-4 mb-2 text-3xl font-bold first:mt-0")}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className={cn("mt-4 mb-2 text-2xl font-semibold first:mt-0")}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className={cn("mt-3 mb-2 text-xl font-semibold first:mt-0")}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className={cn("mt-3 mb-2 text-lg font-medium first:mt-0")}>{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className={cn("mt-2 mb-2 text-base font-medium first:mt-0")}>{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className={cn("mt-2 mb-2 text-sm font-medium first:mt-0")}>{children}</h6>
  ),
  // Paragraphs
  p: ({ children }) => <p className={cn("mb-2 leading-normal last:mb-0")}>{children}</p>,
  // Lists
  ul: ({ children }) => (
    <ul className={cn("pb-4 pl-8 list-disc last:mb-0 [&_ul]:mb-0 [&_ol]:mb-0")}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className={cn("pb-4 pl-8 list-decimal last:mb-0 [&_ul]:mb-0 [&_ol]:mb-0")}>{children}</ol>
  ),
  li: ({ children }) => (
    <li className={cn("leading-normal mb-px [&>p]:mb-0 [&>p:last-child]:mb-0")}>{children}</li>
  ),
  // Code
  // code: ({ children, ...props }) => {
  //   const isInline = !props.className?.includes("language-")
  //   return isInline ? (
  //     <InlineCode
  //       className={cn(props.className, isDark && "bg-primary-50/25 text-primary-50")}
  //     >
  //       {children}
  //     </InlineCode>
  //   ) : (
  //     <code className="block">{children}</code>
  //   )
  // },
  // Horizontal rules
  hr: () => <hr className="border-primary-200 my-8 border-t" />,
  // Strong/Bold
  strong: ({ children }) => <strong className={cn("font-semibold")}>{children}</strong>,
  // Emphasis/Italic
  em: ({ children }) => <em className={cn("italic")}>{children}</em>,
  // // Tables
  // table: ({ children }) => (
  //   <div className="mb-4">
  //     <Table>{children}</Table>
  //   </div>
  // ),
  // thead: ({ children }) => <TableHeader className="bg-primary-50">{children}</TableHeader>,
  // tbody: ({ children }) => <TableBody>{children}</TableBody>,
  // tr: ({ children }) => <TableRow>{children}</TableRow>,
  // th: ({ children }) => <TableHead>{children}</TableHead>,
  // td: ({ children }) => <TableCell>{children}</TableCell>,
  // tfoot: ({ children }) => <TableFooter>{children}</TableFooter>,
  // caption: ({ children }) => <TableCaption>{children}</TableCaption>,
} satisfies Components

/** The three renderers whose colours depend on the theme, resolved once per theme. */
function buildThemedComponents(isDark: boolean) {
  return {
    ...BASE_COMPONENTS,
    pre: ({ children }) => (
      <pre
        className={cn(
          "mb-4 overflow-x-auto rounded-lg p-4 text-sm",
          isDark ? "bg-primary-600" : "bg-primary",
        )}
      >
        {children}
      </pre>
    ),
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          "mb-4 border-l-4 py-2 pl-4 italic",
          isDark
            ? "bg-primary-600 text-primary-100 border-primary-500"
            : "bg-primary-50 border-primary-100 text-primary-500",
        )}
      >
        {children}
      </blockquote>
    ),
    // Links
    a: ({ children, href }) => (
      <a
        href={href}
        className={cn(
          "inline-flex w-fit items-center gap-1 underline underline-offset-2 transition-colors hover:no-underline",
          isDark
            ? "text-primary-200 hover:text-primary-100"
            : "text-primary-400 hover:text-primary-600",
        )}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children} <ExternalLinkIcon className="size-4" />
      </a>
    ),
  } satisfies Components
}

const LIGHT_COMPONENTS = buildThemedComponents(false)
const DARK_COMPONENTS = buildThemedComponents(true)

export function MarkdownWrapper({ content, end, theme = "light" }: MarkdownProps) {
  const components = theme === "dark" ? DARK_COMPONENTS : LIGHT_COMPONENTS

  // `end` trails the last paragraph, so it's the only renderer that can't be resolved ahead of
  // time. Callers that don't use it get the shared map untouched.
  const withEnd: Components = end
    ? {
        ...components,
        p: ({ children }) => (
          <p className={cn("mb-2 leading-normal last:mb-0")}>
            {children} {end}
          </p>
        ),
      }
    : components

  return (
    <Markdown remarkPlugins={REMARK_PLUGINS} components={withEnd}>
      {content}
    </Markdown>
  )
}
