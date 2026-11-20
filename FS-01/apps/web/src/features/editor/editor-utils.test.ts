import { describe, expect, it } from "vitest";
import { collaboratorColor, initials } from "./editor-utils";
import { slashCommands } from "./slash-command-menu";

describe("editor presentation helpers", () => {
  it("assigns stable collaborator colors", () => {
    expect(collaboratorColor("user-123")).toBe(collaboratorColor("user-123"));
    expect(collaboratorColor("user-123")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("creates accessible initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("  Prince  ")).toBe("P");
    expect(initials(" ")).toBe("?");
  });

  it("exposes the required slash block commands", () => {
    expect(slashCommands.map((command) => command.label)).toEqual(
      expect.arrayContaining(["Heading 1", "Checklist", "Code block", "Table"]),
    );
  });
});
