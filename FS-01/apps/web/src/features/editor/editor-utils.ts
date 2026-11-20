export interface CollaboratorIdentity {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
}

const cursorPalette = [
  "#7057d9",
  "#0f8b8d",
  "#d05a44",
  "#2374ab",
  "#b76d00",
  "#9b4d96",
  "#24824a",
  "#c33c67",
] as const;

export function collaboratorColor(userId: string): string {
  let hash = 0;
  for (const character of userId) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return cursorPalette[hash % cursorPalette.length]!;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}
