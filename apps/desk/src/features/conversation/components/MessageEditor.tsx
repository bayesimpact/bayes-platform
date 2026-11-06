import { Code } from "@tiptap/extension-code"
import { Document } from "@tiptap/extension-document"
import { HardBreak } from "@tiptap/extension-hard-break"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text } from "@tiptap/extension-text"
import { UndoRedo } from "@tiptap/extensions"
import { EditorContent, Extension, useEditor } from "@tiptap/react"
import { useEffect, useEffectEvent, useRef } from "react"
import { inlineCodeClassName } from "@/components/shared/InlineCode"
import { messageDocumentOf, messageTextOf } from "../message-document"

export type MessageEditorProps = {
  /** The id of the text field, so the page can put the focus back in it. */
  id?: string
  label: string
  /** The id of the text that tells the keys to send and to start a line. */
  describedBy: string
  content: string
  onContentChange: (content: string) => void
  /** Enter, which sends the message; Shift+Enter starts a new line. */
  onSubmit: () => void
}

/**
 * The text field of the message box, as in the Claude app: a passage between backticks becomes a
 * chip as soon as its second backtick is typed or pasted, and leaves as that same text. The
 * editor lives outside React; the message stays a string for the rest of the Desk.
 */
export function MessageEditor({
  id,
  label,
  describedBy,
  content,
  onContentChange,
  onSubmit,
}: MessageEditorProps) {
  // The text the editor last gave the page, which tells its own changes from the page's.
  const emittedRef = useRef(content)
  // Effect events: the editor keeps the handlers it starts with, and must call the latest ones.
  const handleChange = useEffectEvent((text: string) => onContentChange(text))
  const handleSubmit = useEffectEvent(() => onSubmit())

  const editor = useEditor(
    {
      extensions: [
        Document,
        Paragraph,
        Text,
        HardBreak,
        UndoRedo,
        // What is written right after a chip stays plain text, as in the Claude app.
        Code.extend({ inclusive: false }).configure({
          HTMLAttributes: { class: inlineCodeClassName },
        }),
        // Above the editor's own keys: Enter sends, Shift+Enter starts a new line.
        Extension.create({
          name: "sendOnEnter",
          priority: 1000,
          addKeyboardShortcuts: () => ({
            Enter: () => {
              handleSubmit()
              return true
            },
            "Shift-Enter": ({ editor: shortcutEditor }) => shortcutEditor.commands.splitBlock(),
          }),
        }),
      ],
      content: messageDocumentOf(content),
      autofocus: "end",
      // Tailwind styles the field: the editor injects no stylesheet of its own.
      injectCSS: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          ...(id ? { id } : {}),
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": label,
          "aria-describedby": describedBy,
          "data-slot": "input-group-control",
          class:
            "relative max-h-60 min-h-14 w-full overflow-y-auto px-4 pt-4 pb-2 text-base leading-relaxed whitespace-pre-wrap wrap-break-word outline-none",
        },
      },
      onUpdate: ({ editor: updatedEditor }) => {
        const text = messageTextOf(updatedEditor.getJSON())
        emittedRef.current = text
        handleChange(text)
      },
    },
    [id, label, describedBy],
  )

  // The page changes the text on its own (a dictation, an MCP App, a message sent or put back):
  // the editor, outside React, follows it.
  useEffect(() => {
    if (!editor || content === emittedRef.current) return
    emittedRef.current = content
    editor.commands.setContent(messageDocumentOf(content), { emitUpdate: false })
    editor.commands.focus("end")
  }, [editor, content])

  return <EditorContent editor={editor} className="w-full" />
}
