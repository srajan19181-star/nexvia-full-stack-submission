import type { Editor } from "@tiptap/react";
import { Braces, CheckSquare, Heading1, Heading2, List, ListOrdered, Quote, Table2, Text } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

interface SlashCommand {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  run: (editor: Editor) => void;
}

export const slashCommands: SlashCommand[] = [
  { label: "Text", description: "Plain paragraph", icon: Text, run: (editor) => editor.chain().focus().setParagraph().run() },
  { label: "Heading 1", description: "Large section heading", icon: Heading1, run: (editor) => editor.chain().focus().setHeading({ level: 1 }).run() },
  { label: "Heading 2", description: "Medium section heading", icon: Heading2, run: (editor) => editor.chain().focus().setHeading({ level: 2 }).run() },
  { label: "Bullet list", description: "Create an unordered list", icon: List, run: (editor) => editor.chain().focus().toggleBulletList().run() },
  { label: "Numbered list", description: "Create an ordered list", icon: ListOrdered, run: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { label: "Checklist", description: "Track action items", icon: CheckSquare, run: (editor) => editor.chain().focus().toggleTaskList().run() },
  { label: "Quote", description: "Highlight a quotation", icon: Quote, run: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { label: "Code block", description: "Display a code snippet", icon: Braces, run: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { label: "Table", description: "Insert a 3 by 3 table", icon: Table2, run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
];

export function SlashCommandMenu({ editor, selectedIndex, onSelect }: { editor: Editor; selectedIndex: number; onSelect: (index: number) => void }) {
  return (
    <div className="glass-panel absolute left-4 top-4 z-30 w-[min(330px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-2 shadow-[0_24px_80px_-28px_var(--glow-blue)] backdrop-blur-2xl" role="listbox" aria-label="Insert block">
      <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Insert a block</p>
      <div className="scrollbar-thin max-h-72 overflow-y-auto">
        {slashCommands.map((command, index) => {
          const Icon = command.icon;
          return (
            <button
              key={command.label}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(index)}
              className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", index === selectedIndex ? "bg-[var(--brand-soft)] text-[var(--brand-cyan)]" : "hover:bg-[var(--glass-hover)]")}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]"><Icon className="size-4" /></span>
              <span><span className="block text-sm font-medium">{command.label}</span><span className="block text-xs text-[var(--muted-foreground)]">{command.description}</span></span>
            </button>
          );
        })}
      </div>
      <p className="border-t border-[var(--glass-border)] px-2 pt-2 text-[10px] text-[var(--muted-foreground)]">Use arrow keys and Enter. Escape closes.</p>
    </div>
  );
}
