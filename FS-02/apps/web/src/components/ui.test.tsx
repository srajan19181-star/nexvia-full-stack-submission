import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { Empty } from "./ui";
import { describe, expect, it } from "vitest";
describe("Empty state",()=>{it("renders accessible guidance",()=>{render(<Empty title="No orders" description="Start shopping"/>);expect(screen.getByText("No orders")).toBeInTheDocument();expect(screen.getByText("Start shopping")).toBeInTheDocument()})});
