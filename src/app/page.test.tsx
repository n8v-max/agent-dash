import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("`/` — the positioning line, and one link (R-N1, ticket 37)", () => {
  it("renders the line as the page's heading, inside a main landmark", () => {
    render(<Home />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Agent spend, measured per finished task. Not per token, not per seat.",
    );
  });

  it("makes no productivity claim", () => {
    // Ticket 05: measuring a gain needs a pre-agent baseline and the window is entirely
    // agent-assisted, so the product asserts no such thing. The hero is where that position is
    // easiest to lose, and "Ship faster. Know why." is what stood here before.
    render(<Home />);

    const copy = screen.getByRole("main").textContent ?? "";

    expect(copy).not.toMatch(/faster|productiv|velocity|ship more|10x/i);
  });

  it("offers exactly one link, to sign-in (R-N1's scope)", () => {
    render(<Home />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/sign-in");
  });
});
