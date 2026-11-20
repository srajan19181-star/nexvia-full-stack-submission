import type { Editor } from "@tiptap/react";
import {
  Bold,
  Braces,
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolButtonProps {
  label: string;
  active?: boolean | undefined;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolButton({ label, active = false, disabled = false, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg border border-transparent text-[var(--muted-foreground)] transition hover:border-[var(--glass-border)] hover:bg-[var(--glass-hover)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-35",
        active && "border-[var(--glass-border-strong)] bg-[var(--brand-soft)] text-[var(--brand-cyan)] shadow-[0_8px_22px_-14px_var(--glow-cyan)]",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--glass-border)]" />;
}

export function EditorToolbar({ editor, editable }: { editor: Editor | null; editable: boolean }) {
  const disabled = !editor || !editable;
  const run = (command: (editor: Editor) => void) => () => {
    if (editor && editable) command(editor);
  };

  const setLink = () => {
    if (!editor || !editable) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", previous ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  return (
    <div className="scrollbar-thin flex min-h-12 items-center overflow-x-auto border-b border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--glass-strong)_82%,transparent)] px-3 py-2 backdrop-blur-2xl" role="toolbar" aria-label="Editor formatting">
      <ToolButton label="Undo" disabled={disabled || !editor?.can().undo()} onClick={run((value) => value.chain().focus().undo().run())}><Undo2 className="size-4" /></ToolButton>
      <ToolButton label="Redo" disabled={disabled || !editor?.can().redo()} onClick={run((value) => value.chain().focus().redo().run())}><Redo2 className="size-4" /></ToolButton>
      <Divider />
      <ToolButton label="Heading 1" active={editor?.isActive("heading", { level: 1 })} disabled={disabled} onClick={run((value) => value.chain().focus().toggleHeading({ level: 1 }).run())}><Heading1 className="size-4" /></ToolButton>
      <ToolButton label="Heading 2" active={editor?.isActive("heading", { level: 2 })} disabled={disabled} onClick={run((value) => value.chain().focus().toggleHeading({ level: 2 }).run())}><Heading2 className="size-4" /></ToolButton>
      <ToolButton label="Heading 3" active={editor?.isActive("heading", { level: 3 })} disabled={disabled} onClick={run((value) => value.chain().focus().toggleHeading({ level: 3 }).run())}><Heading3 className="size-4" /></ToolButton>
      <Divider />
      <ToolButton label="Bold (Ctrl+B)" active={editor?.isActive("bold")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleBold().run())}><Bold className="size-4" /></ToolButton>
      <ToolButton label="Italic (Ctrl+I)" active={editor?.isActive("italic")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleItalic().run())}><Italic className="size-4" /></ToolButton>
      <ToolButton label="Underline (Ctrl+U)" active={editor?.isActive("underline")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleUnderline().run())}><Underline className="size-4" /></ToolButton>
      <ToolButton label="Strikethrough" active={editor?.isActive("strike")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleStrike().run())}><Strikethrough className="size-4" /></ToolButton>
      <ToolButton label="Link" active={editor?.isActive("link")} disabled={disabled} onClick={setLink}><Link2 className="size-4" /></ToolButton>
      <ToolButton label="Inline code" active={editor?.isActive("code")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleCode().run())}><Code2 className="size-4" /></ToolButton>
      <Divider />
      <ToolButton label="Bullet list" active={editor?.isActive("bulletList")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleBulletList().run())}><List className="size-4" /></ToolButton>
      <ToolButton label="Numbered list" active={editor?.isActive("orderedList")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleOrderedList().run())}><ListOrdered className="size-4" /></ToolButton>
      <ToolButton label="Checklist" active={editor?.isActive("taskList")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleTaskList().run())}><CheckSquare className="size-4" /></ToolButton>
      <ToolButton label="Blockquote" active={editor?.isActive("blockquote")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleBlockquote().run())}><Quote className="size-4" /></ToolButton>
      <ToolButton label="Code block" active={editor?.isActive("codeBlock")} disabled={disabled} onClick={run((value) => value.chain().focus().toggleCodeBlock().run())}><Braces className="size-4" /></ToolButton>
      <ToolButton label="Insert table" disabled={disabled} onClick={run((value) => value.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><Table2 className="size-4" /></ToolButton>
    </div>
  );
}
