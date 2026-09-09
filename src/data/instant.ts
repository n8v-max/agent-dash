// **One instant formatter in the product**, for the same reason there is one money formatter
// (R-N15, ticket 41): two spellings of the same moment on two surfaces read as two moments.
//
// It was `queries/context.ts`'s private helper, feeding `/demo/history`'s Started column. R-N3.1
// gave it a second reader — the as-of stamp in the global bar, which names the last session the
// dataset holds — and the whole point of that stamp is that a viewer can check it against the top
// row of `/demo/history`. Two formatters would have made that check fail on the punctuation.
//
// **Assembled from parts rather than from a formatted string**, so the field order does not
// depend on the server's locale, and **pinned to the Organization's declared timezone** rather
// than the server's (R-M10). The output is `YYYY-MM-DD HH:MM`: sortable, unambiguous, and the
// same shape as the civil dates the date-range inputs carry.

/** An instant as the Organization reads it (R-M10, R-N19). Unparseable input is passed through. */
export const instantIn = (timezone: string): ((iso: string) => string) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return (iso) => {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return iso;
    const parts = Object.fromEntries(
      formatter.formatToParts(at).map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  };
};
