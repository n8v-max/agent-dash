// Route shell only. Ticket 28 supplies `src/data/queries.ts` and wave 9 the panels; this
// exists so the route exists behind the authorization boundary in `layout.tsx`.

export default function HistoryPage() {
  return (
    <section>
      <h1>History</h1>
      <p>The raw rows under every aggregate (R-N19).</p>
    </section>
  );
}
