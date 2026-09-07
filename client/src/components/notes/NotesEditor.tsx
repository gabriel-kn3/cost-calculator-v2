/**
 * Product notes.
 *
 * ONE field, ONE format. Both editors read and write the same Markdown string
 * on `products.notes`. That is the whole design: if the rich editor stored
 * HTML or ProseMirror JSON while the phone stored plain text, editing a note on
 * the wrong device would silently destroy the other's formatting.
 *
 * The rich editor appears only on wide screens AND only when enabled in
 * Settings. Below lg it is always the textarea -- a formatting toolbar in a
 * 375px column costs more room than it earns.
 */
import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ListChecks,
  Link2,
  Link2Off,
  Heading2,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared extension set, so the editor and the read-only renderer agree. */
function extensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // Nothing here needs code blocks or blockquotes; fewer ways to produce
      // Markdown the textarea cannot round-trip cleanly.
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      // Only http(s) and mailto: a pasted javascript: URL must never survive.
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    // Checklists: StarterKit does not bundle these, and they are how the
    // operator writes steps.
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({ html: false, linkify: true, transformPastedText: true }),
  ];
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the selection
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "grid size-8 place-items-center rounded transition-colors disabled:opacity-40",
        active ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-card-border px-2 py-1.5">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered steps"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Checklist"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks className="size-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton label="Add link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Remove link"
        disabled={!editor.isActive("link")}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Link2Off className="size-4" />
      </ToolbarButton>

      <span className="ml-auto flex items-center gap-0.5">
        <ToolbarButton
          label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" />
        </ToolbarButton>
      </span>
    </div>
  );
}

/**
 * tiptap-markdown augments editor.storage at runtime but ships no types for
 * it, so this is the single place the cast lives.
 */
interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}
function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
}

/** Tailwind cannot style ProseMirror's output generically, so scope it here. */
const PROSE =
  "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-24 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 " +
  "[&_.ProseMirror_p]:my-1 [&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 " +
  "[&_.ProseMirror_ol]:my-1 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 " +
  "[&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-semibold " +
  "[&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:text-sm [&_.ProseMirror_h3]:font-semibold " +
  "[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:underline-offset-2 " +
  "[&_.ProseMirror_ul[data-type=taskList]]:list-none [&_.ProseMirror_ul[data-type=taskList]]:pl-0 " +
  "[&_.ProseMirror_ul[data-type=taskList]_li]:flex [&_.ProseMirror_ul[data-type=taskList]_li]:gap-2";

export function RichNotesEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: extensions(),
    content: value,
    onUpdate: ({ editor }) => {
      // Serialise back to Markdown on every change -- the stored format never
      // becomes HTML or JSON.
      onChange(getMarkdown(editor));
    },
    editorProps: { attributes: { "aria-label": placeholder ?? "Notes" } },
  });

  // Adopt external changes (loading a product) without clobbering typing.
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor);
    if (value !== current) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border border-input bg-card text-sm", PROSE)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

/** Read-only rendering, using the same extensions so parsing cannot diverge. */
export function NotesPreview({ markdown }: { markdown: string }) {
  const editor = useEditor(
    { extensions: extensions(), content: markdown, editable: false },
    [markdown],
  );
  if (!markdown.trim()) return <p className="text-xs text-muted-foreground">No notes.</p>;
  if (!editor) return null;
  return (
    <div className={cn("text-sm", PROSE, "[&_.ProseMirror]:px-0 [&_.ProseMirror]:py-0")}>
      <EditorContent editor={editor} />
    </div>
  );
}

export function PlainNotesEditor({
  value,
  onChange,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Notes"
      className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  );
}
