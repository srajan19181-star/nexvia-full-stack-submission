import type { CreateCommentInput } from "@nexvia/shared";
import type { Editor } from "@tiptap/react";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "y-prosemirror";
import * as Y from "yjs";

export type CommentAnchor = NonNullable<CreateCommentInput["anchor"]>;

function encode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function mappingFor(editor: Editor) {
  const pluginState = ySyncPluginKey.getState(editor.state) as { binding?: { mapping?: unknown } } | undefined;
  return pluginState?.binding?.mapping;
}

export function createCommentAnchor(editor: Editor, document: Y.Doc): CommentAnchor | null {
  const { from, to } = editor.state.selection;
  const mapping = mappingFor(editor);
  if (from >= to || !mapping) return null;
  const fragment = document.getXmlFragment("default");
  const quote = editor.state.doc.textBetween(from, to, " ").trim().slice(0, 2_000);
  if (!quote) return null;

  return {
    start: encode(Y.encodeRelativePosition(absolutePositionToRelativePosition(from, fragment, mapping as never))),
    end: encode(Y.encodeRelativePosition(absolutePositionToRelativePosition(to, fragment, mapping as never))),
    stateVector: encode(Y.encodeStateVector(document)),
    quote,
  };
}

export function resolveCommentAnchor(
  editor: Editor,
  document: Y.Doc,
  anchor: Pick<CommentAnchor, "start" | "end">,
): { from: number; to: number } | null {
  const mapping = mappingFor(editor);
  if (!mapping) return null;
  try {
    const fragment = document.getXmlFragment("default");
    const from = relativePositionToAbsolutePosition(
      document,
      fragment,
      Y.decodeRelativePosition(decode(anchor.start)),
      mapping as never,
    );
    const to = relativePositionToAbsolutePosition(
      document,
      fragment,
      Y.decodeRelativePosition(decode(anchor.end)),
      mapping as never,
    );
    return from !== null && to !== null && from < to ? { from, to } : null;
  } catch {
    return null;
  }
}
