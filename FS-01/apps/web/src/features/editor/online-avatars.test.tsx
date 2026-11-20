import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OnlineAvatars } from "./online-avatars";

describe("OnlineAvatars", () => {
  it("summarizes authenticated presence and multiple devices", () => {
    render(<OnlineAvatars members={[
      { id: "ada", name: "Ada Lovelace", avatarUrl: null, color: "#7057d9", clientCount: 2 },
      { id: "grace", name: "Grace Hopper", avatarUrl: null, color: "#0f8b8d", clientCount: 1 },
    ]} />);

    expect(screen.getByLabelText("2 online members")).toBeInTheDocument();
    expect(screen.getByTitle("Ada Lovelace (2 devices)")).toHaveTextContent("AL");
    expect(screen.getByText("2 online")).toBeInTheDocument();
  });
});
