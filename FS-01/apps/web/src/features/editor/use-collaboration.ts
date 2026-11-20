import { useEffect, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "forbidden";
export type SaveState = "connecting" | "saved" | "saving" | "queued";

interface CollaborationResource {
  document: Y.Doc;
  provider: WebsocketProvider;
}

export interface OnlineMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  clientCount: number;
}

export function useCollaboration(
  pageId: string,
  generation: number,
  enabled: boolean,
  onDocumentReset?: () => void,
) {
  const [resource, setResource] = useState<CollaborationResource | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [saveState, setSaveState] = useState<SaveState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const documentReset = useRef(onDocumentReset);
  documentReset.current = onDocumentReset;

  useEffect(() => {
    if (!enabled || !pageId) return;
    const document = new Y.Doc();
    const configuredUrl = (import.meta.env.VITE_COLLABORATION_URL ?? "ws://localhost:4001/collaboration").replace(/\/$/, "");
    const provider = new WebsocketProvider(configuredUrl, pageId, document, {
      connect: true,
      maxBackoffTime: 2_500,
      params: { generation: generation.toString() },
    });
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const deferStateUpdate = (update: () => void) => {
      queueMicrotask(() => {
        if (!disposed) update();
      });
    };
    setResource({ document, provider });
    setConnectionState("connecting");
    setSaveState("connecting");
    setErrorMessage(null);

    const onStatus = ({ status }: { status: "connected" | "connecting" | "disconnected" }) => {
      deferStateUpdate(() => {
        setConnectionState(status);
        if (status === "disconnected") {
          setSaveState((current) => current === "saving" ? "queued" : current);
        }
      });
    };
    const onSync = (synced: boolean) => {
      if (synced) {
        deferStateUpdate(() => {
          setConnectionState("connected");
          setSaveState("saved");
        });
      }
    };
    const onClosed = (event: { code: number; reason: string }) => {
      if (event.code === 4_409) {
        deferStateUpdate(() => {
          setConnectionState("connecting");
          setSaveState("connecting");
          setErrorMessage("A document revision was restored. Reloading the current version…");
          documentReset.current?.();
        });
        return;
      }
      if (event.code >= 4_400 && event.code < 4_500) {
        deferStateUpdate(() => {
          setConnectionState("forbidden");
          setErrorMessage(event.code === 4_401 ? "Your session expired. Sign in again to collaborate." : event.reason || "Your access to this page changed.");
        });
      }
    };
    const onDocumentUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === provider) return;
      deferStateUpdate(() => {
        if (saveTimer) clearTimeout(saveTimer);
        if (!provider.wsconnected) {
          setSaveState("queued");
          return;
        }
        setSaveState("saving");
        saveTimer = setTimeout(() => {
          if (!disposed) setSaveState(provider.wsconnected ? "saved" : "queued");
        }, 700);
      });
    };
    const onAwarenessChange = () => {
      const members = new Map<string, OnlineMember>();
      for (const state of provider.awareness.getStates().values()) {
        const rawUser = state.user as Record<string, unknown> | undefined;
        if (!rawUser || typeof rawUser.id !== "string" || typeof rawUser.name !== "string" || typeof rawUser.color !== "string") continue;
        const existing = members.get(rawUser.id);
        members.set(rawUser.id, {
          id: rawUser.id,
          name: rawUser.name,
          avatarUrl: typeof rawUser.avatarUrl === "string" ? rawUser.avatarUrl : null,
          color: rawUser.color,
          clientCount: (existing?.clientCount ?? 0) + 1,
        });
      }
      const nextMembers = [...members.values()].sort((left, right) => left.name.localeCompare(right.name));
      deferStateUpdate(() => setOnlineMembers(nextMembers));
    };

    provider.on("status", onStatus);
    provider.on("sync", onSync);
    provider.on("closed", onClosed);
    document.on("update", onDocumentUpdate);
    provider.awareness.on("change", onAwarenessChange);

    return () => {
      disposed = true;
      if (saveTimer) clearTimeout(saveTimer);
      document.off("update", onDocumentUpdate);
      provider.awareness.off("change", onAwarenessChange);
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      provider.off("closed", onClosed);
      provider.destroy();
      document.destroy();
      setResource(null);
      setOnlineMembers([]);
    };
  }, [enabled, generation, pageId]);

  return { resource, connectionState, saveState, errorMessage, onlineMembers };
}
