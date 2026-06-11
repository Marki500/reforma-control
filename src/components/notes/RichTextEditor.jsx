import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Minus,
  Undo2,
  Redo2,
} from 'lucide-react'

export default function RichTextEditor({ content, onChange, placeholder }) {
  const internalUpdating = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Escribe una nota...' }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-stone prose-sm max-w-none focus:outline-none min-h-[120px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      internalUpdating.current = true
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed && !internalUpdating.current) {
      editor.commands.setContent(content || '', false)
    }
    internalUpdating.current = false
  }, [content, editor])

  useEffect(() => {
    return () => editor?.destroy()
  }, [editor])

  if (!editor) return null

  const tools = [
    {
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive('bold'),
      label: 'Negrita',
    },
    {
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive('italic'),
      label: 'Cursiva',
    },
    {
      icon: Heading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive('heading', { level: 2 }),
      label: 'Título',
    },
    {
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
      label: 'Lista',
    },
    {
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
      label: 'Lista num.',
    },
    {
      icon: Minus,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      active: false,
      label: 'Línea',
    },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white transition-all focus-within:border-stone-400 focus-within:ring-2 focus-within:ring-stone-400/20">
      <div className="flex items-center gap-0.5 border-b border-stone-100 px-2 py-1.5">
        {tools.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.label}
              type="button"
              onClick={t.action}
              className={`rounded-lg p-1.5 transition-colors ${
                t.active
                  ? 'bg-stone-200 text-stone-700'
                  : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
              }`}
              title={t.label}
            >
              <Icon size={16} />
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-30"
            title="Deshacer"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-30"
            title="Rehacer"
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
