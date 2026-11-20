import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/app/theme-provider";
import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("presents the primary collaboration value and registration action", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { level: 1, name: /work beautifully, together/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create your workspace/i })).toHaveAttribute("href", "/register");
  });
});
