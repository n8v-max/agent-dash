// A named placeholder for the panels wave 9 builds.
//
// It exists because the shell is a real surface before the charts are: a viewer landing on
// `/demo/spend` today should see the page's controls working against a page that says what it
// will hold, rather than a heading over nothing. The list is `spec.md` § 3's panel order, so the
// placeholder is also the checklist the panel ticket renders against.
//
// It carries no figures — nothing here is a metric, and nothing here reads a query.

export function PendingPanels(props: { readonly panels: readonly string[] }) {
  return (
    <section
      aria-label="Panels in progress"
      className="rounded-xl border border-dashed border-border bg-muted/30 p-6"
    >
      <p className="text-sm font-medium text-foreground">Panels land here</p>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        The shell and its controls are live; every control on this page already serialises to the
        query string. The panels are built in the panel wave, in the order this page declares:
      </p>
      <ol className="mt-4 space-y-1 text-sm text-muted-foreground">
        {props.panels.map((panel, position) => (
          <li key={panel} className="flex gap-3">
            <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground/70">
              {position + 1}
            </span>
            <span>{panel}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
