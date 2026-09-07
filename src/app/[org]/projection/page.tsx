// Route shell only. Ticket 28 supplies `src/data/queries.ts` and wave 9 the panels; this
// exists so the route exists behind the authorization boundary in `layout.tsx`.

export default function ProjectionPage() {
  return (
    <section>
      <h1>Projection</h1>
      <p>Where the current month lands (R-N23).</p>
    </section>
  );
}
