// Route shell only. Ticket 28 supplies `src/data/queries.ts` and wave 9 the panels; this
// exists so the route exists behind the authorization boundary in `layout.tsx`.

export default function WorkPage() {
  return (
    <section>
      <h1>Work</h1>
      <p>Whether the agents are working (R-N12).</p>
    </section>
  );
}
