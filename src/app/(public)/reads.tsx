// The four reads on `/` — copy and structure (ticket 60).
//
// **The figures are copy.** They are the human's, recorded in ticket 59's last comment, and they
// do not match the committed fixture: $76.50 against the fixture's $27.02 per completed Job, and
// so on down the column. That is the recorded MVP decision — hardcoded, no "illustrative" label,
// no live read from the demo Organization — and the band label *Figures from the demo
// organisation* is the whole of the disclosure. Do not "fix" them to the fixture here.
//
// **Five parts per read, in one vertical order**: label · claim · figure and caption · reading ·
// verb. The claim is an <h2>, so the page's outline is the four claims under the slogan; the
// verb is the small-caps line a reader acts on. The layout that turns four articles into one
// grid with three bands is `landing.css`; this file only names the cells.

type Read = {
  readonly label: string;
  readonly claim: string;
  readonly figure: string;
  readonly caption: string;
  /** The bold lead of the reading — the sentence the figure is for. */
  readonly lead: string;
  readonly rest: string;
  readonly verb: string;
};

export const READS: readonly Read[] = [
  {
    label: "01 · Unit cost",
    claim: "Your cost per finished job, and which way it is moving",
    figure: "$76.50",
    caption: "per finished job in August, up from $64.83 in May",
    lead: "+18% since May, on 1.4× the jobs.",
    rest: "Failed attempts and idle seats are in the numerator, so waste raises the figure.",
    verb: "Defend it to finance",
  },
  {
    label: "02 · Where it leaks",
    claim: "81 cents of every dollar landed on an attempt that was accepted",
    figure: "19%",
    caption: "of spend on failed attempts and idle seats",
    lead: "Both can be cut without cutting output.",
    rest: "41 of 570 tasks needed a second attempt, and one seat sat nearly idle all season.",
    verb: "Reclaim it",
  },
  {
    label: "03 · Where it converts",
    claim: "The same agents, a 20× spread by where you point them",
    figure: "$7 → $144",
    caption: "per finished job, by repository and template",
    lead: "Push agents where the work converts.",
    rest: "Where it does not, change the template or take the work back. Deploy converts one in three.",
    verb: "Redirect the work",
  },
  {
    label: "04 · Where the cloud earns its keep",
    claim: "A third of agent machine time runs with nobody at the keyboard",
    figure: "35%",
    caption: "of attempts run headless; a further 32% of supervised time is unattended",
    lead: "The cloud earns its keep when work runs while people are elsewhere.",
    rest: "Where sessions are mostly supervised, a laptop would have done.",
    verb: "Offload the right work",
  },
];

export const BAND_LABEL = "Figures from the demo organisation";

const SMALL_CAPS = "text-[11.5px] font-semibold uppercase tracking-[0.12em]";

/**
 * One read: five cells and three bands, all direct children of the article so that
 * `display: contents` can hand them to the section's grid above 640px. The bands are
 * decorative and hidden from assistive technology; the band label is real text and is not.
 */
function ReadArticle({ read }: { readonly read: Read }) {
  return (
    <article className="landing-read">
      <p className="landing-read-label landing-serif m-0 pb-3.5 pt-[22px] pr-7 text-[13px] font-medium tracking-normal text-(--landing-ink-3)">
        {read.label}
      </p>

      <div aria-hidden="true" className="landing-band landing-band-claims" />
      <div className="landing-read-claim px-7 py-[26px]">
        <h2 className="landing-serif m-0 text-pretty text-[22px] leading-[1.22] tracking-[-0.01em]">
          {read.claim}
        </h2>
      </div>

      <div aria-hidden="true" className="landing-band landing-band-figures" />
      <p className={`landing-band-label m-0 pt-2.5 text-[10.5px] ${SMALL_CAPS} text-(--landing-ink-3)`}>
        {BAND_LABEL}
      </p>
      <div className="landing-read-figure px-7 pb-[26px] pt-[30px]">
        <div className="landing-serif mt-1.5 text-[44px] leading-none tabular-nums">
          {read.figure}
        </div>
        <small className="mt-2.5 block text-[12.5px] font-medium leading-[1.35] text-(--landing-ink-2)">
          {read.caption}
        </small>
      </div>

      <div aria-hidden="true" className="landing-band landing-band-readings" />
      <div className="landing-read-reading px-7 pb-[26px] pt-6">
        <p className="m-0 text-[14.5px] leading-[1.5] text-(--landing-ink-2)">
          <b className="font-semibold text-(--landing-ink)">{read.lead}</b> {read.rest}
        </p>
      </div>

      <p className={`landing-read-verb m-0 pr-7 pt-4 ${SMALL_CAPS} text-(--landing-ink)`}>
        {read.verb}
      </p>
    </article>
  );
}

export function Reads() {
  return (
    <section className="landing-reads mt-2">
      {READS.map((read) => (
        <ReadArticle key={read.label} read={read} />
      ))}
    </section>
  );
}
