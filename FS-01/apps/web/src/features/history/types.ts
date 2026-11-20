export interface SnapshotItem {
  id: string;
  generation: number;
  updateId: string | null;
  kind: "PERIODIC" | "MILESTONE" | "PRE_RESTORE" | "RESTORE";
  label: string | null;
  restoredFromId: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface SnapshotPreview extends Omit<SnapshotItem, "updateId" | "restoredFromId"> {
  state: string;
}
