import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { adminUploadNewsImage, avatarUrl } from '../api';

interface NewsRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  onUploadError?: (message: string) => void;
}

type ToolBtn = {
  title: string;
  label: string;
  group?: string;
  active?: boolean;
  action: () => void;
};

export default function NewsRichEditor({
  value,
  onChange,
  disabled = false,
  onUploadingChange,
  onUploadError,
}: NewsRichEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastHtmlRef = useRef(value);
  const [, setEditorTick] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({ HTMLAttributes: { class: 'news-inline-image' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '<p></p>',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML();
      lastHtmlRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'news-tiptap-content',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setEditorTick((n) => n + 1);
    editor.on('selectionUpdate', bump);
    editor.on('transaction', bump);
    return () => {
      editor.off('selectionUpdate', bump);
      editor.off('transaction', bump);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '<p></p>';
    if (incoming !== current && incoming !== lastHtmlRef.current) {
      editor.commands.setContent(incoming, false);
      lastHtmlRef.current = incoming;
    }
  }, [editor, value]);

  const run = (fn: () => void) => {
    if (!editor || disabled) return;
    fn();
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL ссылки', prev || 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const uploadImage = async (file: File) => {
    onUploadingChange?.(true);
    try {
      const { url } = await adminUploadNewsImage(file);
      const src = avatarUrl(url) ?? url;
      editor?.chain().focus().setImage({ src, alt: '' }).run();
    } catch (err) {
      onUploadError?.(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      onUploadingChange?.(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  if (!editor) {
    return <div className="news-tiptap-loading muted">Загрузка редактора...</div>;
  }

  const toolbar: ToolBtn[] = [
    {
      title: 'Жирный',
      label: 'B',
      group: 'fmt',
      active: editor.isActive('bold'),
      action: () => run(() => editor.chain().focus().toggleBold().run()),
    },
    {
      title: 'Курсив',
      label: 'I',
      group: 'fmt',
      active: editor.isActive('italic'),
      action: () => run(() => editor.chain().focus().toggleItalic().run()),
    },
    {
      title: 'Подчёркнутый',
      label: 'U',
      group: 'fmt',
      active: editor.isActive('underline'),
      action: () => run(() => editor.chain().focus().toggleUnderline().run()),
    },
    {
      title: 'Зачёркнутый',
      label: 'S',
      group: 'fmt',
      active: editor.isActive('strike'),
      action: () => run(() => editor.chain().focus().toggleStrike().run()),
    },
    {
      title: 'Заголовок 1',
      label: 'H1',
      group: 'head',
      active: editor.isActive('heading', { level: 1 }),
      action: () => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run()),
    },
    {
      title: 'Заголовок 2',
      label: 'H2',
      group: 'head',
      active: editor.isActive('heading', { level: 2 }),
      action: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()),
    },
    {
      title: 'Заголовок 3',
      label: 'H3',
      group: 'head',
      active: editor.isActive('heading', { level: 3 }),
      action: () => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run()),
    },
    {
      title: 'Маркированный список',
      label: '•',
      group: 'list',
      active: editor.isActive('bulletList'),
      action: () => run(() => editor.chain().focus().toggleBulletList().run()),
    },
    {
      title: 'Нумерованный список',
      label: '1.',
      group: 'list',
      active: editor.isActive('orderedList'),
      action: () => run(() => editor.chain().focus().toggleOrderedList().run()),
    },
    {
      title: 'Цитата',
      label: '❝',
      group: 'block',
      active: editor.isActive('blockquote'),
      action: () => run(() => editor.chain().focus().toggleBlockquote().run()),
    },
    {
      title: 'Код',
      label: '</>',
      group: 'block',
      active: editor.isActive('codeBlock'),
      action: () => run(() => editor.chain().focus().toggleCodeBlock().run()),
    },
    {
      title: 'По левому краю',
      label: '⫷',
      group: 'align',
      active: editor.isActive({ textAlign: 'left' }),
      action: () => run(() => editor.chain().focus().setTextAlign('left').run()),
    },
    {
      title: 'По центру',
      label: '≡',
      group: 'align',
      active: editor.isActive({ textAlign: 'center' }),
      action: () => run(() => editor.chain().focus().setTextAlign('center').run()),
    },
    {
      title: 'Ссылка',
      label: '🔗',
      group: 'insert',
      active: editor.isActive('link'),
      action: () => run(setLink),
    },
    {
      title: 'Изображение',
      label: '🖼',
      group: 'insert',
      action: () => imageInputRef.current?.click(),
    },
  ];

  return (
    <div className="news-tiptap-wrap">
      <div className="news-editor-toolbar" role="toolbar" aria-label="Форматирование">
        {toolbar.map((btn) => (
          <button
            key={btn.title}
            type="button"
            className={`news-editor-tool ${btn.group ? `news-editor-tool-${btn.group}` : ''} ${
              btn.active ? 'is-active' : ''
            }`}
            title={btn.title}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={btn.action}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="news-tiptap-editor" />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImage(file);
        }}
      />
    </div>
  );
}
