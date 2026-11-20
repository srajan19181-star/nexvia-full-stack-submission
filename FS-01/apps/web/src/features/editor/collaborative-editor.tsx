import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor, type Editor, type Extensions } from "@tiptap/react";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { useEffect, useState, type KeyboardEvent } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { SlashCommandMenu, slashCommands } from "./slash-command-menu";
import type { CollaboratorIdentity } from "./editor-utils";

export interface CaretProvider {
  awareness: Awareness;
}

interface CollaborativeEditorProps {
  document: Y.Doc;
  provider?: CaretProvider;
  currentUser: CollaboratorIdentity;
  editable: boolean;
  onEditorReady?: (editor: Editor | null) => void;
}

function caretElement(user: Record<string, unknown>): HTMLElement {
  const cursor = document.createElement("span");
  cursor.className = "collaboration-caret";
  cursor.style.borderColor = typeof user.color === "string" ? user.color : "var(--brand)";
  const label = document.createElement("span");
  label.className = "collaboration-caret__label";
  label.style.backgroundColor = typeof user.color === "string" ? user.color : "var(--brand)";
  label.textContent = typeof user.name === "string" ? user.name : "Collaborator";
  cursor.append(label);
  return cursor;
}

function editorExtensions(document: Y.Doc, provider: CaretProvider | undefined, currentUser: CollaboratorIdentity): Extensions {
  const extensions: Extensions = [
    StarterKit.configure({
      undoRedo: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true, lastColumnResizable: false } }),
    Placeholder.configure({ placeholder: "Type '/' for commands, or start writing…" }),
    Collaboration.configure({ document, field: "default" }),
  ];

  if (provider) {
    extensions.push(
      CollaborationCaret.configure({
        provider,
        user: currentUser,
        render: caretElement,
        selectionRender: (user) => ({
          class: "collaboration-selection",
          style: `background-color: ${typeof user.color === "string" ? user.color : "var(--brand)"}2e`,
        }),
      }),
    );
  }

  return extensions;
}

export function CollaborativeEditor({ document, provider, currentUser, editable, onEditorReady }: CollaborativeEditorProps) {
  const [slashOpen, setSlashOpen] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState(0);
  const editor = useEditor({
    extensions: editorExtensions(document, provider, currentUser),
    editable,
    editorProps: {
      attributes: {
        class: "orvyn-editor",
        spellcheck: "true",
        "aria-label": "Document content",
      },
    },
  }, [document, provider, currentUser.id]);

  useEffect(() => {
    if (!editor) return;
    const readyTimer = window.setTimeout(() => onEditorReady?.(editor), 0);
    return () => {
      window.clearTimeout(readyTimer);
      window.setTimeout(() => onEditorReady?.(null), 0);
    };
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editable, editor]);

  const chooseCommand = (index: number) => {
    const command = slashCommands[index];
    if (!editor || !command) return;
    const cursor = editor.state.selection.from;
    if (cursor > 0 && editor.state.doc.textBetween(cursor - 1, cursor) === "/") {
      editor.chain().focus().deleteRange({ from: cursor - 1, to: cursor }).run();
    }
    command.run(editor);
    setSlashOpen(false);
    setSelectedCommand(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!editable) return;
    if (!slashOpen && event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      setSlashOpen(true);
      setSelectedCommand(0);
      return;
    }
    if (!slashOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setSlashOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedCommand((value) => (value + 1) % slashCommands.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedCommand((value) => (value - 1 + slashCommands.length) % slashCommands.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseCommand(selectedCommand);
    }
  };

  return (
    <section className="glass-panel overflow-hidden rounded-[2rem] border border-[var(--glass-border)] bg-[var(--glass)] shadow-[var(--shadow-panel)] backdrop-blur-2xl" aria-label="Collaborative editor">
      <EditorToolbar editor={editor} editable={editable} />
      <div className="relative" onKeyDown={handleKeyDown}>
        {slashOpen && editor && <SlashCommandMenu editor={editor} selectedIndex={selectedCommand} onSelect={chooseCommand} />}
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}
