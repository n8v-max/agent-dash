import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";
import { READS } from "./reads";

describe("`/` — the slogan, one link, and four reads (R-N1; tickets 37 and 60)", () => {
  it("renders the slogan as the page's heading, inside a main landmark", () => {
    render(<Home />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "What your agents do, spend and solve, per finished job.",
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

  it("renders the four claims as level-2 headings, in order (ticket 60)", () => {
    // The outline is the slogan and the four claims under it. One <h2> per read, in source
    // order at every width — the layout moves cells, never the DOM.
    render(<Home />);

    const claims = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

    expect(claims).toEqual(READS.map((read) => read.claim));
  });
});
