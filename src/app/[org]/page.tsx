// Route shell only. Ticket 28 supplies `src/data/queries.ts` and wave 9 the panels; this
// exists so the route exists behind the authorization boundary in `layout.tsx`.

export default function OrgSummaryPage() {
  return (
    <section>
      <h1>Summary</h1>
      <p>Four tiles land here (R-N4).</p>
    </section>
  );
}
