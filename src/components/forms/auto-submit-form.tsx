"use client";

// **A `GET` form that submits itself when one of its fields changes**, and the whole of the
// client JavaScript the control layer needs.
//
// `/demo/history`'s date range used to end in an Apply button, which made it the only control in
// the product that took two actions to set: every other one is a link, and following a link is
// the action. The button is gone and the range applies on change.
//
// **It is not in `components/controls/`, deliberately.** That directory carries a structural
// guarantee — no module in it is a Client Component, so no `useState` is in scope that *could*
// shadow a control value (R-T25), and `page-toolbar.test.tsx` asserts the absence over the whole
// directory rather than trusting a reading of the diff. A `"use client"` file there would spend
// that guarantee to buy one event handler. So the handler lives out here, where it is a *form
// behaviour* rather than a control, and `DateRangeControl` stays what it was: a server-rendered
// `<form>` whose inputs the browser serialises into the query string.
//
// **It mirrors nothing.** No `useState`, no `useRef`, no `useSearchParams`. The inputs are
// uncontrolled and their `defaultValue`s come from the parsed URL on the server; this reads the
// form element the event already handed it and asks the browser to submit. R-T25's claim — the
// query string is the single source of truth — is untouched, because there is no second copy of
// anything here to go stale.
//
// **`checkValidity()` is the guard, and it is doing real work.** React's `onChange` on a
// `type="date"` input fires on the `input` event, so a viewer typing a date fires it once per
// keystroke. A partially typed date has an **empty** `value`, and `required` makes that invalid;
// a complete date outside the observation window is invalid against the inputs' own `min`/`max`.
// Either way the form does not submit, so the range that reaches the URL is a range the page can
// actually be read over — the same coercion `schema.ts` performs on the way back in (R-T26),
// arrived at before the navigation rather than after it.

import type { FormEvent, ReactNode } from "react";

export function AutoSubmitForm(props: {
  /** Names the form, which is what gives a `<form>` its `form` role at all. */
  readonly label: string;
  readonly action: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const submitIfValid = (event: FormEvent<HTMLFormElement>): void => {
    const form = event.currentTarget;
    if (form.checkValidity()) form.requestSubmit();
  };

  return (
    <form
      method="get"
      aria-label={props.label}
      action={props.action}
      onChange={submitIfValid}
      className={props.className}
    >
      {props.children}
    </form>
  );
}
