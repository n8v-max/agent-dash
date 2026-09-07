// Route shell only. Ticket 28 supplies `src/data/queries.ts` and wave 9 the panels; this
// exists so the route exists behind the authorization boundary in `layout.tsx`.

export default function PeoplePage() {
  return (
    <section>
      <h1>People</h1>
      <p>Who, and how they compare (R-N15).</p>
    </section>
  );
}
