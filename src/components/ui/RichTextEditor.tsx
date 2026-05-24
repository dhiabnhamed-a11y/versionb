'use client'

import { useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Underline as UnderlineIcon, Palette, List, ListOrdered } from 'lucide-react'

const COLORS = [
  { label: 'Default', value: '#1e293b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Pink', value: '#ec4899' },
]

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  maxHeight?: number
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something...',
  minHeight = 100,
  maxHeight = 400,
}: RichTextEditorProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ underline: false }),
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none px-4 py-3 min-h-[100px]',
        style: `min-height: ${minHeight}px; max-height: ${maxHeight}px; overflow-y: auto;`,
      },
    },
  })

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = e.target.value
      if (editor) {
        editor.chain().focus().setColor(color).run()
      }
    },
    [editor],
  )

  const handleCustomColorClick = useCallback(() => {
    colorInputRef.current?.click()
  }, [])

  if (!editor) return null

  return (
    <div
      className="rich-text-editor"
      style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--bg-card)',
      }}
    >
      <div
        className="rich-text-toolbar"
        style={{
          display: 'flex',
          gap: '2px',
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon size={15} />
        </ToolbarButton>

        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered list"
        >
          <ListOrdered size={15} />
        </ToolbarButton>

        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

        <div className="color-picker-wrapper" style={{ position: 'relative' }}>
          <ToolbarButton
            active={editor.isActive('textStyle')}
            onClick={handleCustomColorClick}
            title="Text color"
          >
            <Palette size={15} />
          </ToolbarButton>
          <input
            ref={colorInputRef}
            type="color"
            onChange={handleColorChange}
            style={{
              position: 'absolute',
              top: '100%',
              left: '0',
              width: '1px',
              height: '1px',
              padding: '0',
              border: 'none',
              opacity: '0',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: '3px',
              marginLeft: '4px',
              alignItems: 'center',
            }}
          >
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => editor.chain().focus().setColor(c.value).run()}
                title={c.label}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: c.value,
                  border:
                    editor.getAttributes('textStyle').color === c.value
                      ? '2px solid var(--accent)'
                      : '2px solid var(--border)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetColor().run()}
              title="Remove color"
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '2px solid var(--border)',
                cursor: 'pointer',
                padding: 0,
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                lineHeight: '1',
                color: '#94a3b8',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <EditorContent editor={editor} />

      <style jsx>{`
        .rich-text-editor :global(.ProseMirror) {
          padding: 12px 16px;
          min-height: ${minHeight}px;
          max-height: ${maxHeight}px;
          overflow-y: auto;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-primary);
          outline: none;
        }
        .rich-text-editor :global(.ProseMirror p) {
          margin: 0;
        }
        .rich-text-editor :global(.ProseMirror ul),
        .rich-text-editor :global(.ProseMirror ol) {
          padding-left: 1.5em;
          margin: 4px 0;
        }
        .rich-text-editor :global(.ProseMirror li) {
          margin: 2px 0;
        }
        .rich-text-editor :global(.ProseMirror li p) {
          margin: 0;
        }
        .rich-text-editor :global(.ProseMirror p.is-editor-empty:first-child::before) {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-muted);
          pointer-events: none;
          height: 0;
          opacity: 0.6;
        }
        .rich-text-editor :global(.ProseMirror:focus) {
          outline: none;
        }
        .rich-text-editor :global(.ProseMirror::-webkit-scrollbar) {
          width: 6px;
        }
        .rich-text-editor :global(.ProseMirror::-webkit-scrollbar-track) {
          background: transparent;
        }
        .rich-text-editor :global(.ProseMirror::-webkit-scrollbar-thumb) {
          background: var(--border);
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px',
        borderRadius: '6px',
        border: 'none',
        background: active ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--accent-subtle)'
          e.currentTarget.style.color = 'var(--accent)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }
      }}
    >
      {children}
    </button>
  )
}
