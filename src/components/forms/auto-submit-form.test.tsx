// **The date range applies on change, and only when the change is a range** (R-N20, ticket 43).
//
// The Apply button is gone, so the guard is the whole feature: React's `onChange` on a
// `type="date"` input fires on the `input` event, which means a viewer *typing* a date fires it
// several times before there is a date to apply. Submitting on the first of those would navigate
// to a range the page cannot be read over, and the viewer would land somewhere else mid-keystroke.
//
// **`requestSubmit` is spied on rather than followed.** jsdom does not navigate, so the assertion
// a browser would make — the URL changed — is not available at this layer; it is `e2e/controls`'s
// (T-E13). What is provable here is the decision: given this form state, did the control ask to
// submit at all. That is the branch, and it is the one that breaks.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoSubmitForm } from "./auto-submit-form";

const submitted = vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => {});

afterEach(() => {
  submitted.mockClear();
});

const dateRange = (bounds: { min: string; max: string }) =>
  render(
    <AutoSubmitForm label="Date range" action="/demo/history">
      <input type="hidden" name="work_type" value="bugfix" />
      <input type="date" name="from" aria-label="From" required defaultValue="2026-04-01" {...bounds} />
      <input type="date" name="to" aria-label="To" required defaultValue="2026-09-08" {...bounds} />
    </AutoSubmitForm>,
  );

const BOUNDS = { min: "2026-04-01", max: "2026-09-08" };

describe("A GET form that applies itself on change", () => {
  it("submits as soon as a complete, in-window date is entered", () => {
    dateRange(BOUNDS);

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-01" } });

    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it("does not submit a half-typed date", () => {
    dateRange(BOUNDS);

    // An incomplete `type="date"` input reads as the empty string, and `required` refuses it.
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });

    expect(submitted).not.toHaveBeenCalled();
  });

  it("does not submit a date outside the observation window", () => {
    dateRange(BOUNDS);

    // Outside the window there are no rows, so the range is not a period the page has: the
    // inputs' own `min`/`max` refuse it before a navigation rather than after one (R-T26).
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2027-01-01" } });

    expect(submitted).not.toHaveBeenCalled();
  });

  it("is a GET form to the path it was given, so the browser writes the query string", () => {
    dateRange(BOUNDS);
    const form = screen.getByRole("form", { name: "Date range" });

    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/demo/history");
  });
});
