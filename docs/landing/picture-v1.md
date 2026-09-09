# Picture v1 — the editorial ledger

Status: 2026-09-10, for iteration. Rendered at [`img/picture-v1.png`](img/picture-v1.png) from
[`img/picture-v1.html`](img/picture-v1.html) at 1440px. Nothing is live. Content is Shape C with
the five competitor edits applied; the structure follows the uploaded landing-page guide's eleven
elements, with two of them adapted honestly rather than faked.

## The fit

**Editorial.** The product is an argument in sequence about money, and its voice refuses claims. A
ledger read like a magazine feature suits both: strong typographic hierarchy, numbers set as type,
asymmetric hero, generous whitespace, one ink colour. The other candidates were weighed and set
aside: *Minimalist* is where the current landing already sits and reads as obscure; *Brutalist*
would fight the trust the page has to build with a finance reader; *Bold* and *Retro* are wrong for
the buyer.

## The design system

| Decision | Choice | Why |
|---|---|---|
| Display face | **Fraunces**, weight 500, italic 300 for the emphasised phrase | a soft serif with optical sizing; reads as print, not as SaaS |
| Body face | **Manrope** | quiet, wide counters, tabular numerals available |
| Surface | paper `#f6f3ee`, faint horizontal rules every 48px | the ledger; avoids the flat white the guide warns against without a gradient |
| Ink | navy `#14213d` for text, CTA, the two dark bands | one dominant colour, used in at least four places |
| Data hue | blue `#2a78d6` | only ever on data marks and the hero figure; never decorative |
| Reserved accents | orange `#eb6834` for *not accepted*, aqua `#1baf7a` for seats | the two leaks; validated as a categorical set with the blue on 2026-09-10 |
| Shape | pill buttons, 12–14px card radii, dashed ledger rules | soft, but not rounded-everything |
| Motion (not rendered) | staggered hero reveal, cards fade up on scroll, `prefers-reduced-motion` honoured | one entrance, no scattered micro-animation |

## The eleven elements, and what each one is here

| # | Element | On the page | Note |
|---|---|---|---|
| 1 | URL | `/` | keyword slugs are a marketing-site concern; the app's route axis is the question (R-N1) |
| 2 | Logo and header | mark top-left, four anchors, one pill CTA, sticky with blur | header links are a change to R-N1's single-link rule; see below |
| 3 | Title and subtitle | *What your agents cost per finished Job.* / *Accountability for the agent bill: where it converts, where it leaks, and who has it figured out.* | the emphasised phrase is the claim; "accountability" is the 2026 buyer word (competitors § 2) |
| 4 | Primary CTA | *Open the demo →*, secondary *Read the method*, note *Two seeded accounts. No password.* | the friction is stated as zero because it is |
| 5 | Social proof | the ledger card: 742 attempts, 424 finished Jobs, $9,117, 46% in seats, $14.30 per finished Job | **adapted.** No customers exist; the proof is the demo organisation's own figures, labelled as such |
| 6 | Media | the real `/demo` screenshot in a tilted frame with the four-tile caption | no device mockup; the product frame is the product |
| 7 | Core benefits | the four cards, numbered, each with arithmetic line, chart, reading and a verb | Defend · Reclaim · Redirect · Spread |
| 8 | Testimonials | four published research quotes: METR, DORA, CloudZero/Vantage, LinearB | **adapted.** Real attributed quotes from brief 15, introduced as *none is a customer quote* |
| 9 | FAQ | six questions, two columns, open by default in the render | answers lift from `CONTEXT.md`, `spec.md` § 1, ADR-0003, ADR-0005 |
| 10 | Final CTA | navy band, *Read your own bill per finished Job.*, the two accounts as cards | the thirty-second path in one sentence |
| 11 | Footer | four columns: about, Product, Method, Source; legal line | Privacy / Terms / Contact pages do not exist and are placeholders |

Between 7 and 8 sits a band the guide does not name: the positioning against usage and delivery
dashboards, which the competitor read made the page's sharpest line.

## What is true, what is placeholder

- **Every figure is computed from the committed fixture** (Shape C § 2). The demo's own tiles will
  differ by cents.
- **All quotes are verbatim from brief 15 § 8** with their sources; none is invented.
- **Placeholders:** the footer legal links, the *Method* nav target (would be `CONTEXT.md` or a docs
  route), and *Read the method*.
- **Not shipped panels:** the three-segment split (card 2) and the grid (card 3), as recorded on
  ticket 59. If the page shows them, the demo must.

## What it disturbs

- `<h1>` text in `page.test.tsx` and `smoke.spec.ts`; the positioning table row.
- R-N1's *one link*: this page has a header nav, two hero CTAs, a final CTA and footer links. Either
  R-N1 is amended to *one destination* (every CTA goes to `/sign-in`; anchors are in-page) or the
  tests assert the set explicitly. Recommended: amend to one destination.
- The forbidden-word regex: the copy was checked; none of `faster`, `productiv`, `velocity`,
  `ship more`, `10x` appears.

## Things to iterate on

1. The ledger card competes with the h1 for the eye at first glance. Options: drop its last row's
   blue, or move the card below the fold as the first "proof" band.
2. Card 4's paired bars are the quietest chart on the page; a single dumbbell (cost per Job, best
   Team vs organisation) might read faster.
3. Whether the evidence section belongs above or below the FAQ for a finance reader.
4. The background rules: keep as ledger texture, or restrict to the hero.
5. Dark mode is not drawn. The app supports it; the ledger would invert to a slate surface.
